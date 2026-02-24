from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
from app.database import supabase_admin
from app.schemas.nutrition import ProfileResponse, ProfileUpdate

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/", response_model=ProfileResponse)
async def get_profile(user=Depends(get_current_user)):
    response = supabase_admin.table("profiles").select("*").eq("id", user["id"]).single().execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileResponse(**response.data)


@router.patch("/", response_model=ProfileResponse)
async def update_profile(updates: ProfileUpdate, user=Depends(get_current_user)):
    payload = updates.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="No fields to update")
    response = supabase_admin.table("profiles").update(payload).eq("id", user["id"]).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Update failed")
    return ProfileResponse(**response.data[0])
