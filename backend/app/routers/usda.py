from fastapi import APIRouter, Depends, HTTPException, Query
import httpx

from app.auth import get_current_user
from app.config import settings
from app.schemas.nutrition import USDAFoodResult, UPCLookupResult

router = APIRouter(prefix="/usda", tags=["usda"])

USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

# Nutrient IDs in USDA FoodData Central
NUTRIENT_ENERGY   = 1008
NUTRIENT_PROTEIN  = 1003
NUTRIENT_FAT      = 1004
NUTRIENT_CARBS    = 1005
NUTRIENT_FIBER    = 1079


def _extract_nutrient(nutrients: list[dict], nutrient_id: int) -> float:
    for n in nutrients:
        if n.get("nutrientId") == nutrient_id:
            return round(n.get("value", 0.0), 2)
    return 0.0


def _normalize(value: float, serving_size: float) -> float:
    """Convert a per-serving nutrient value to per-100g."""
    if serving_size <= 0:
        return value
    return round((value / serving_size) * 100, 2)


@router.get("/search", response_model=list[USDAFoodResult])
async def search_foods(
    query: str = Query(..., min_length=1),
    _user=Depends(get_current_user),
):
    usda_query = query.replace("'", "").replace('"', "")
    params = {
        "query": usda_query,
        "api_key": settings.usda_api_key,
        "dataType": ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded Food"],
        "pageSize": 20,
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(USDA_SEARCH_URL, params=params, timeout=20.0)
        print("USDA request URL:", response.request.url)

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"USDA API error {response.status_code}: {response.text[:300]}",
        )

    foods = response.json().get("foods", [])
    results = []
    for food in foods:
        nutrients = food.get("foodNutrients", [])
        is_branded = food.get("dataType") == "Branded Food"
        serving_size = food.get("servingSize", 100) if is_branded else 100

        def extract(nutrient_id: int) -> float:
            raw = _extract_nutrient(nutrients, nutrient_id)
            return _normalize(raw, serving_size) if is_branded else raw

        results.append(USDAFoodResult(
            fdc_id=food["fdcId"],
            name=food["description"].title(),
            calories_per_100g=extract(NUTRIENT_ENERGY),
            protein_per_100g=extract(NUTRIENT_PROTEIN),
            carbs_per_100g=extract(NUTRIENT_CARBS),
            fat_per_100g=extract(NUTRIENT_FAT),
            fiber_per_100g=extract(NUTRIENT_FIBER),
        ))
    return results


def _usda_food_to_upc_result(food: dict, upc: str) -> UPCLookupResult:
    nutrients = food.get("foodNutrients", [])
    serving_size = food.get("servingSize", 100)

    def extract(nutrient_id: int) -> float:
        raw = _extract_nutrient(nutrients, nutrient_id)
        return _normalize(raw, serving_size)

    return UPCLookupResult(
        upc=upc,
        source="usda",
        source_name=food["description"].title(),
        usda_fdc_id=str(food["fdcId"]),
        calories_per_100g=extract(NUTRIENT_ENERGY),
        protein_per_100g=extract(NUTRIENT_PROTEIN),
        carbs_per_100g=extract(NUTRIENT_CARBS),
        fat_per_100g=extract(NUTRIENT_FAT),
        fiber_per_100g=extract(NUTRIENT_FIBER),
    )


@router.get("/upc/{upc}", response_model=UPCLookupResult)
async def lookup_by_upc(upc: str, _user=Depends(get_current_user)):
    # Step 1: Try USDA branded food search by GTIN/UPC
    async with httpx.AsyncClient() as client:
        usda_res = await client.get(
            USDA_SEARCH_URL,
            params={
                "query": upc,
                "api_key": settings.usda_api_key,
                "dataType": ["Branded Food"],
                "pageSize": 10,
            },
            timeout=20.0,
        )

    if usda_res.status_code == 200:
        foods = usda_res.json().get("foods", [])
        normalized_upc = upc.lstrip("0")
        for food in foods:
            gtin = food.get("gtinUpc", "")
            if gtin and gtin.lstrip("0") == normalized_upc:
                return _usda_food_to_upc_result(food, upc)

    # Step 2: Fall back to Open Food Facts
    async with httpx.AsyncClient() as client:
        off_res = await client.get(
            f"https://world.openfoodfacts.org/api/v0/product/{upc}.json",
            timeout=10.0,
        )

    if off_res.status_code == 200:
        data = off_res.json()
        if data.get("status") == 1:
            product = data["product"]
            n = product.get("nutriments", {})
            return UPCLookupResult(
                upc=upc,
                source="open_food_facts",
                source_name=product.get("product_name", ""),
                calories_per_100g=round(float(n.get("energy-kcal_100g", 0) or 0), 2),
                protein_per_100g=round(float(n.get("proteins_100g", 0) or 0), 2),
                carbs_per_100g=round(float(n.get("carbohydrates_100g", 0) or 0), 2),
                fat_per_100g=round(float(n.get("fat_100g", 0) or 0), 2),
                fiber_per_100g=round(float(n.get("fiber_100g", 0) or 0), 2),
            )

    raise HTTPException(status_code=404, detail="Product not found")
