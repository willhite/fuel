from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.database import supabase_admin
from app.schemas.nutrition import IngredientCreate, IngredientUpdate, IngredientResponse

router = APIRouter(prefix="/ingredients", tags=["ingredients"])

# TODO: Restrict write operations to admin users once a roles system is in place.


@router.get("/", response_model=list[IngredientResponse])
async def list_ingredients(_user=Depends(get_current_user)):
    res = supabase_admin.table("ingredients").select("*").order("name").execute()
    return res.data or []


@router.post("/", response_model=IngredientResponse, status_code=status.HTTP_201_CREATED)
async def create_ingredient(data: IngredientCreate, _user=Depends(get_current_user)):
    res = supabase_admin.table("ingredients").insert(data.model_dump()).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create ingredient")
    return res.data[0]


@router.patch("/{ingredient_id}", response_model=IngredientResponse)
async def update_ingredient(ingredient_id: str, data: IngredientUpdate, _user=Depends(get_current_user)):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = (
        supabase_admin.table("ingredients")
        .update(update)
        .eq("id", ingredient_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update ingredient")
    return res.data[0]


@router.delete("/{ingredient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ingredient(ingredient_id: str, _user=Depends(get_current_user)):
    supabase_admin.table("ingredients").delete().eq("id", ingredient_id).execute()
