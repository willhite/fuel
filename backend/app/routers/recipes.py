from fastapi import APIRouter, Depends, HTTPException, status
from datetime import date

from app.auth import get_current_user
from app.database import supabase_admin
from app.schemas.nutrition import (
    RecipeCreate,
    RecipeIngredientAdd,
    RecipeIngredientResponse,
    RecipeIngredientUpdate,
    RecipeIngredientOverride,
    RecipeLogRequest,
    RecipeResponse,
    RecipeUpdate,
    MealResponse,
    MealPortionUpdate,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _compute_totals(ingredients: list[dict]) -> dict:
    return {
        "total_calories": sum(i["quantity"] * i["calories_per_unit"] for i in ingredients),
        "total_protein": sum(i["quantity"] * i["protein_per_unit"] for i in ingredients),
        "total_carbs": sum(i["quantity"] * i["carbs_per_unit"] for i in ingredients),
        "total_fat": sum(i["quantity"] * i["fat_per_unit"] for i in ingredients),
        "total_fiber": sum(i["quantity"] * i["fiber_per_unit"] for i in ingredients),
    }


def _build_response(recipe: dict, ingredients: list[dict]) -> RecipeResponse:
    totals = _compute_totals(ingredients)
    return RecipeResponse(
        id=recipe["id"],
        name=recipe["name"],
        servings=recipe["servings"],
        ingredients=[RecipeIngredientResponse(**i) for i in ingredients],
        **totals,
    )


def _get_recipe_or_404(recipe_id: str, user_id: str) -> dict:
    res = (
        supabase_admin.table("recipes")
        .select("*")
        .eq("id", recipe_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return res.data


@router.post("/", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def create_recipe(recipe: RecipeCreate, user=Depends(get_current_user)):
    payload = {**recipe.model_dump(), "user_id": user["id"]}
    res = supabase_admin.table("recipes").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create recipe")
    return _build_response(res.data[0], [])


@router.get("/", response_model=list[RecipeResponse])
async def list_recipes(user=Depends(get_current_user)):
    recipes_res = (
        supabase_admin.table("recipes")
        .select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    recipes = recipes_res.data or []
    if not recipes:
        return []
    recipe_ids = [r["id"] for r in recipes]
    ingredients_res = (
        supabase_admin.table("recipe_ingredients")
        .select("*")
        .in_("recipe_id", recipe_ids)
        .execute()
    )
    ingredients_by_recipe: dict[str, list] = {r["id"]: [] for r in recipes}
    for ing in (ingredients_res.data or []):
        ingredients_by_recipe[ing["recipe_id"]].append(ing)
    return [_build_response(r, ingredients_by_recipe[r["id"]]) for r in recipes]


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(recipe_id: str, user=Depends(get_current_user)):
    recipe = _get_recipe_or_404(recipe_id, user["id"])
    ingredients_res = (
        supabase_admin.table("recipe_ingredients")
        .select("*")
        .eq("recipe_id", recipe_id)
        .order("created_at")
        .execute()
    )
    return _build_response(recipe, ingredients_res.data or [])


@router.patch("/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(recipe_id: str, data: RecipeUpdate, user=Depends(get_current_user)):
    _get_recipe_or_404(recipe_id, user["id"])
    res = supabase_admin.table("recipes").update({"name": data.name}).eq("id", recipe_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update recipe")
    ingredients_res = (
        supabase_admin.table("recipe_ingredients")
        .select("*")
        .eq("recipe_id", recipe_id)
        .order("created_at")
        .execute()
    )
    return _build_response(res.data[0], ingredients_res.data or [])


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recipe(recipe_id: str, user=Depends(get_current_user)):
    _get_recipe_or_404(recipe_id, user["id"])
    supabase_admin.table("recipes").delete().eq("id", recipe_id).execute()


@router.post("/{recipe_id}/ingredients", response_model=RecipeIngredientResponse, status_code=status.HTTP_201_CREATED)
async def add_ingredient(recipe_id: str, ingredient: RecipeIngredientAdd, user=Depends(get_current_user)):
    _get_recipe_or_404(recipe_id, user["id"])
    payload = {**ingredient.model_dump(), "recipe_id": recipe_id}
    res = supabase_admin.table("recipe_ingredients").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to add ingredient")
    return RecipeIngredientResponse(**res.data[0])


@router.patch("/{recipe_id}/ingredients/{ingredient_id}", response_model=RecipeIngredientResponse)
async def update_ingredient(recipe_id: str, ingredient_id: str, data: RecipeIngredientUpdate, user=Depends(get_current_user)):
    _get_recipe_or_404(recipe_id, user["id"])
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = (
        supabase_admin.table("recipe_ingredients")
        .update(update)
        .eq("id", ingredient_id)
        .eq("recipe_id", recipe_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update ingredient")
    return RecipeIngredientResponse(**res.data[0])


@router.delete("/{recipe_id}/ingredients/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_ingredient(recipe_id: str, ingredient_id: str, user=Depends(get_current_user)):
    _get_recipe_or_404(recipe_id, user["id"])
    supabase_admin.table("recipe_ingredients").delete().eq("id", ingredient_id).eq("recipe_id", recipe_id).execute()


@router.post("/{recipe_id}/log", response_model=MealResponse, status_code=status.HTTP_201_CREATED)
async def log_recipe(recipe_id: str, body: RecipeLogRequest, user=Depends(get_current_user)):
    recipe = _get_recipe_or_404(recipe_id, user["id"])
    if not body.ingredient_overrides:
        raise HTTPException(status_code=400, detail="No ingredients selected")

    # Fetch only the selected ingredients, scoped to this recipe for security
    override_ids = [o.ingredient_id for o in body.ingredient_overrides]
    ingredients_res = (
        supabase_admin.table("recipe_ingredients")
        .select("*")
        .in_("id", override_ids)
        .eq("recipe_id", recipe_id)
        .execute()
    )
    ingredient_by_id = {i["id"]: i for i in (ingredients_res.data or [])}

    # Compute raw totals using the override quantities
    total_calories = 0.0
    total_protein = 0.0
    total_carbs = 0.0
    total_fat = 0.0
    total_fiber = 0.0
    for override in body.ingredient_overrides:
        ing = ingredient_by_id.get(override.ingredient_id)
        if ing:
            total_calories += override.quantity * ing["calories_per_unit"]
            total_protein += override.quantity * ing["protein_per_unit"]
            total_carbs += override.quantity * ing["carbs_per_unit"]
            total_fat += override.quantity * ing["fat_per_unit"]
            total_fiber += override.quantity * ing["fiber_per_unit"]

    # Scale by portion weight if provided
    if body.total_cooked_weight and body.portion_weight and body.total_cooked_weight > 0:
        scale = body.portion_weight / body.total_cooked_weight
    else:
        scale = 1.0

    raw_weight = sum(o.quantity for o in body.ingredient_overrides)

    payload = {
        "user_id": user["id"],
        "logged_date": str(body.logged_date),
        "meal_type": body.meal_type,
        "name": recipe["name"],
        "calories": round(total_calories * scale),
        "protein_g": round(total_protein * scale, 1),
        "carbs_g": round(total_carbs * scale, 1),
        "fat_g": round(total_fat * scale, 1),
        "fiber_g": round(total_fiber * scale, 1),
        "raw_weight": round(raw_weight, 1),
        "total_cooked_weight": round(body.total_cooked_weight, 1) if body.total_cooked_weight else None,
        "portion_weight": round(body.portion_weight, 1) if body.portion_weight else None,
        "recipe_id": recipe_id,
    }
    res = supabase_admin.table("meals").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to log recipe")

    recipe_update: dict = {"last_meal_type": body.meal_type}
    if body.total_cooked_weight:
        recipe_update["last_cooked_weight"] = round(body.total_cooked_weight, 1)
    supabase_admin.table("recipes").update(recipe_update).eq("id", recipe_id).execute()

    return MealResponse(**res.data[0])
