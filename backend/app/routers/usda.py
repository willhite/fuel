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


@router.get("/search", response_model=list[USDAFoodResult])
async def search_foods(
    query: str = Query(..., min_length=1),
    _user=Depends(get_current_user),
):
    params = {
        "query": query,
        "api_key": settings.usda_api_key,
        "dataType": ["Foundation", "SR Legacy"],
        "pageSize": 20,
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(USDA_SEARCH_URL, params=params, timeout=10.0)

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail="USDA API request failed")

    foods = response.json().get("foods", [])
    results = []
    for food in foods:
        nutrients = food.get("foodNutrients", [])
        results.append(USDAFoodResult(
            fdc_id=food["fdcId"],
            name=food["description"].title(),
            calories_per_100g=_extract_nutrient(nutrients, NUTRIENT_ENERGY),
            protein_per_100g=_extract_nutrient(nutrients, NUTRIENT_PROTEIN),
            carbs_per_100g=_extract_nutrient(nutrients, NUTRIENT_CARBS),
            fat_per_100g=_extract_nutrient(nutrients, NUTRIENT_FAT),
            fiber_per_100g=_extract_nutrient(nutrients, NUTRIENT_FIBER),
        ))
    return results
