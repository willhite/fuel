from fastapi import APIRouter, Depends, HTTPException, Query
import httpx

from app.auth import get_current_user
from app.config import settings
from app.schemas.nutrition import USDAFoodResult

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
