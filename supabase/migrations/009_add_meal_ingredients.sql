CREATE TABLE public.meal_ingredients (
  id uuid default gen_random_uuid() primary key,
  meal_id uuid references public.meals(id) on delete cascade not null,
  recipe_ingredient_id uuid references public.recipe_ingredients(id) on delete set null,
  food_name text not null,
  quantity numeric(8,2) not null,
  unit text not null,
  calories_per_unit numeric(8,2) not null default 0,
  protein_per_unit numeric(8,2) not null default 0,
  carbs_per_unit numeric(8,2) not null default 0,
  fat_per_unit numeric(8,2) not null default 0,
  fiber_per_unit numeric(8,2) not null default 0,
  usda_fdc_id text,
  created_at timestamptz not null default now()
);

ALTER TABLE public.meal_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meal ingredients"
  ON public.meal_ingredients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.meals
    WHERE meals.id = meal_ingredients.meal_id AND meals.user_id = auth.uid()
  ));
