from fastapi import APIRouter, Depends, HTTPException, status
from datetime import date
from supabase import create_client
from collections import defaultdict

from app.auth import get_current_user
from app.database import supabase_admin
from app.schemas.nutrition import MealCreate, MealResponse, DailySummary, MealPortionUpdate

router = APIRouter(prefix="/meals", tags=["meals"])


@router.get("/day/{day}", response_model=DailySummary)
async def get_day(day: date, user=Depends(get_current_user)):
    response = (
        supabase_admin.table("meals")
        .select("*")
        .eq("user_id", user["id"])
        .eq("logged_date", str(day))
        .order("created_at")
        .execute()
    )
    meals = response.data or []
    return DailySummary(
        date=day,
        total_calories=sum(m["calories"] for m in meals),
        total_protein=sum(m["protein_g"] or 0 for m in meals),
        total_carbs=sum(m["carbs_g"] or 0 for m in meals),
        total_fat=sum(m["fat_g"] or 0 for m in meals),
        total_fiber=sum(m["fiber_g"] or 0 for m in meals),
        meals=[MealResponse(**m) for m in meals],
    )


@router.post("/", response_model=MealResponse, status_code=status.HTTP_201_CREATED)
async def create_meal(meal: MealCreate, user=Depends(get_current_user)):
    payload = meal.model_dump()
    payload["user_id"] = user["id"]
    payload["logged_date"] = str(payload["logged_date"])
    response = supabase_admin.table("meals").insert(payload).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create meal")
    return MealResponse(**response.data[0])


@router.patch("/{meal_id}/portion", response_model=MealResponse)
async def update_meal_portion(meal_id: str, data: MealPortionUpdate, user=Depends(get_current_user)):
    meal_res = (
        supabase_admin.table("meals")
        .select("*")
        .eq("id", meal_id)
        .eq("user_id", user["id"])
        .single()
        .execute()
    )
    if not meal_res.data:
        raise HTTPException(status_code=404, detail="Meal not found")
    meal = meal_res.data

    update: dict = {"portion_weight": round(data.portion_weight, 1)}

    # Rescale macros proportionally when total_cooked_weight is known
    old_portion = meal.get("portion_weight")
    total_cooked = meal.get("total_cooked_weight")
    if total_cooked and total_cooked > 0:
        old_scale = (old_portion / total_cooked) if old_portion else 1.0
        new_scale = data.portion_weight / total_cooked
        if old_scale > 0:
            ratio = new_scale / old_scale
            update["calories"] = max(0, round(meal["calories"] * ratio))
            update["protein_g"] = round(meal["protein_g"] * ratio, 1)
            update["carbs_g"] = round(meal["carbs_g"] * ratio, 1)
            update["fat_g"] = round(meal["fat_g"] * ratio, 1)
            update["fiber_g"] = round(meal["fiber_g"] * ratio, 1)

    res = (
        supabase_admin.table("meals")
        .update(update)
        .eq("id", meal_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update meal")
    return MealResponse(**res.data[0])


@router.delete("/{meal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_meal(meal_id: str, user=Depends(get_current_user)):
    response = (
        supabase_admin.table("meals")
        .delete()
        .eq("id", meal_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=404, detail="Meal not found")


@router.get("/history", response_model=list[dict])
async def get_history(limit: int = 14, user=Depends(get_current_user)):
    response = (
        supabase_admin.table("meals")
        .select("logged_date, calories, protein_g, carbs_g, fat_g, fiber_g")
        .eq("user_id", user["id"])
        .order("logged_date", desc=True)
        .limit(limit * 10)
        .execute()
    )
    rows = response.data or []
    days: dict = defaultdict(lambda: {"calories": 0, "protein_g": 0.0, "carbs_g": 0.0, "fat_g": 0.0, "fiber_g": 0.0})
    for row in rows:
        d = row["logged_date"]
        days[d]["calories"] += row["calories"]
        days[d]["protein_g"] += row["protein_g"] or 0
        days[d]["carbs_g"] += row["carbs_g"] or 0
        days[d]["fat_g"] += row["fat_g"] or 0
        days[d]["fiber_g"] += row["fiber_g"] or 0
    return [{"date": d, **totals} for d, totals in sorted(days.items(), reverse=True)][:limit]
