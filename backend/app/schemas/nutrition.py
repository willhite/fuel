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
    raw_weight: Optional[float] = None
    total_cooked_weight: Optional[float] = None
    portion_weight: Optional[float] = None
    recipe_id: Optional[str] = None


class MealResponse(MealCreate):
    id: str
    user_id: str
    created_at: str


class DayTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    calories_min: int = Field(default=0, ge=0)
    calories_max: int = Field(default=0, ge=0)
    protein_min: int = Field(default=0, ge=0)
    protein_max: int = Field(default=0, ge=0)
    carbs_min: int = Field(default=0, ge=0)
    carbs_max: int = Field(default=0, ge=0)
    fat_min: int = Field(default=0, ge=0)
    fat_max: int = Field(default=0, ge=0)
    fiber_min: int = Field(default=0, ge=0)
    fiber_max: int = Field(default=0, ge=0)


class DayTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    calories_min: Optional[int] = Field(None, ge=0)
    calories_max: Optional[int] = Field(None, ge=0)
    protein_min: Optional[int] = Field(None, ge=0)
    protein_max: Optional[int] = Field(None, ge=0)
    carbs_min: Optional[int] = Field(None, ge=0)
    carbs_max: Optional[int] = Field(None, ge=0)
    fat_min: Optional[int] = Field(None, ge=0)
    fat_max: Optional[int] = Field(None, ge=0)
    fiber_min: Optional[int] = Field(None, ge=0)
    fiber_max: Optional[int] = Field(None, ge=0)


class DayTypeResponse(DayTypeCreate):
    id: str
    user_id: str


class DailySummary(BaseModel):
    date: date
    total_calories: int
    total_protein: float
    total_carbs: float
    total_fat: float
    total_fiber: float
    meals: list[MealResponse]
    day_type: Optional[DayTypeResponse] = None


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
    checked: bool = True
    calories_per_unit: float = 0.0
    protein_per_unit: float = 0.0
    carbs_per_unit: float = 0.0
    fat_per_unit: float = 0.0
    fiber_per_unit: float = 0.0


class RecipeIngredientUpdate(BaseModel):
    checked: Optional[bool] = None
    quantity: Optional[float] = Field(None, gt=0)


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
    last_cooked_weight: Optional[float] = None
    last_meal_type: Optional[str] = None


class MealPortionUpdate(BaseModel):
    portion_weight: float = Field(..., gt=0)


class IngredientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    calories_per_100g: float = Field(default=0.0, ge=0)
    protein_per_100g: float = Field(default=0.0, ge=0)
    carbs_per_100g: float = Field(default=0.0, ge=0)
    fat_per_100g: float = Field(default=0.0, ge=0)
    fiber_per_100g: float = Field(default=0.0, ge=0)
    usda_fdc_id: Optional[str] = None
    upc: Optional[str] = None
    source: Optional[str] = None
    source_name: Optional[str] = None


class IngredientUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    calories_per_100g: Optional[float] = Field(None, ge=0)
    protein_per_100g: Optional[float] = Field(None, ge=0)
    carbs_per_100g: Optional[float] = Field(None, ge=0)
    fat_per_100g: Optional[float] = Field(None, ge=0)
    fiber_per_100g: Optional[float] = Field(None, ge=0)
    upc: Optional[str] = None
    source: Optional[str] = None
    source_name: Optional[str] = None


class IngredientResponse(IngredientCreate):
    id: str
    created_at: str


class UPCLookupResult(BaseModel):
    upc: str
    source: str
    source_name: str
    usda_fdc_id: Optional[str] = None
    calories_per_100g: float
    protein_per_100g: float
    carbs_per_100g: float
    fat_per_100g: float
    fiber_per_100g: float


class RecipeIngredientOverride(BaseModel):
    ingredient_id: str
    quantity: float  # actual grams used this session


class RecipeLogRequest(BaseModel):
    meal_type: str = Field(..., pattern="^(Breakfast|Lunch|Dinner|Snack)$")
    logged_date: date = Field(default_factory=date.today)
    ingredient_overrides: list[RecipeIngredientOverride]
    total_cooked_weight: Optional[float] = None
    portion_weight: Optional[float] = None
