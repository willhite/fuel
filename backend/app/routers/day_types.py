from fastapi import APIRouter, Depends, HTTPException, status
from datetime import date
from pydantic import BaseModel

from app.auth import get_current_user
from app.database import supabase_admin
from app.schemas.nutrition import DayTypeCreate, DayTypeUpdate, DayTypeResponse


class DayLogSet(BaseModel):
    day_type_id: str

router = APIRouter(prefix="/day-types", tags=["day_types"])


@router.get("/", response_model=list[DayTypeResponse])
async def get_day_types(user=Depends(get_current_user)):
    res = (
        supabase_admin.table("day_types")
        .select("*")
        .eq("user_id", user["id"])
        .order("name")
        .execute()
    )
    return [DayTypeResponse(**row) for row in (res.data or [])]


@router.post("/", response_model=DayTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_day_type(data: DayTypeCreate, user=Depends(get_current_user)):
    payload = data.model_dump()
    payload["user_id"] = user["id"]
    res = supabase_admin.table("day_types").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create day type")
    return DayTypeResponse(**res.data[0])


@router.patch("/{day_type_id}", response_model=DayTypeResponse)
async def update_day_type(day_type_id: str, data: DayTypeUpdate, user=Depends(get_current_user)):
    updates = data.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = (
        supabase_admin.table("day_types")
        .update(updates)
        .eq("id", day_type_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Day type not found")
    return DayTypeResponse(**res.data[0])


@router.delete("/{day_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_day_type(day_type_id: str, user=Depends(get_current_user)):
    res = (
        supabase_admin.table("day_types")
        .delete()
        .eq("id", day_type_id)
        .eq("user_id", user["id"])
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Day type not found")


@router.put("/log/{logged_date}", response_model=DayTypeResponse)
async def set_day_log(logged_date: date, body: DayLogSet, user=Depends(get_current_user)):
    day_type_id = body.day_type_id

    # Verify the day type belongs to this user
    dt_res = (
        supabase_admin.table("day_types")
        .select("*")
        .eq("id", day_type_id)
        .eq("user_id", user["id"])
        .single()
        .execute()
    )
    if not dt_res.data:
        raise HTTPException(status_code=404, detail="Day type not found")

    # Upsert day_logs row
    supabase_admin.table("day_logs").upsert({
        "user_id": user["id"],
        "logged_date": str(logged_date),
        "day_type_id": day_type_id,
    }).execute()

    return DayTypeResponse(**dt_res.data)


@router.delete("/log/{logged_date}", status_code=status.HTTP_204_NO_CONTENT)
async def clear_day_log(logged_date: date, user=Depends(get_current_user)):
    supabase_admin.table("day_logs").delete().eq("user_id", user["id"]).eq("logged_date", str(logged_date)).execute()
