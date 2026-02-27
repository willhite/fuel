from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    calorie_goal: Optional[int] = Field(None, ge=500, le=10000)
    protein_goal: Optional[int] = Field(None, ge=0, le=500)
    carbs_goal: Optional[int] = Field(None, ge=0, le=1000)
    fat_goal: Optional[int] = Field(None, ge=0, le=500)
    fiber_goal: Optional[int] = Field(None, ge=0, le=200)


class ProfileResponse(BaseModel):
    id: str
    email: str
    display_name: Optional[str]
    calorie_goal: int
    protein_goal: int
    carbs_goal: int
    fat_goal: int
    fiber_goal: int


class MealCreate(BaseModel):
    logged_date: date = Field(default_factory=date.today)
    meal_type: str = Field(..., pattern="^(Breakfast|Lunch|Dinner|Snack)$")
    name: str = Field(..., min_length=1, max_length=200)
    calories: int = Field(..., ge=0)
    protein_g: float = Field(default=0.0, ge=0)
    carbs_g: float = Field(default=0.0, ge=0)
    fat_g: float = Field(default=0.0, ge=0)
    fiber_g: float = Field(default=0.0, ge=0)
    notes: Optional[str] = None


class MealResponse(MealCreate):
    id: str
    user_id: str
    created_at: str


class DailySummary(BaseModel):
    date: date
    total_calories: int
    total_protein: float
    total_carbs: float
    total_fat: float
    total_fiber: float
    meals: list[MealResponse]


class USDAFoodResult(BaseModel):
    fdc_id: int
    name: str
    calories_per_100g: float
    protein_per_100g: float
    carbs_per_100g: float
    fat_per_100g: float
    fiber_per_100g: float


class RecipeIngredientAdd(BaseModel):
    food_name: str
    quantity: float = Field(..., gt=0)
    unit: str = "g"
    usda_fdc_id: Optional[int] = None
    calories_per_unit: float = 0.0
    protein_per_unit: float = 0.0
    carbs_per_unit: float = 0.0
    fat_per_unit: float = 0.0
    fiber_per_unit: float = 0.0


class RecipeIngredientResponse(RecipeIngredientAdd):
    id: str
    recipe_id: str


class RecipeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    servings: int = Field(default=1, ge=1)


class RecipeUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class RecipeResponse(BaseModel):
    id: str
    name: str
    servings: int
    ingredients: list[RecipeIngredientResponse]
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fat: float
    total_fiber: float


class RecipeLogRequest(BaseModel):
    meal_type: str = Field(..., pattern="^(Breakfast|Lunch|Dinner|Snack)$")
    logged_date: date = Field(default_factory=date.today)
    servings: float = Field(default=1.0, gt=0)
