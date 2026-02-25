-- ============================================================
-- Migration 003 — Recipe Builder (Phase 3)
-- ============================================================

create table public.recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  servings integer not null default 1,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references public.recipes(id) on delete cascade not null,
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

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy "Users can view own recipes" on public.recipes for select using (auth.uid() = user_id);
create policy "Users can insert own recipes" on public.recipes for insert with check (auth.uid() = user_id);
create policy "Users can update own recipes" on public.recipes for update using (auth.uid() = user_id);
create policy "Users can delete own recipes" on public.recipes for delete using (auth.uid() = user_id);
create policy "Users can manage ingredients of own recipes"
  on public.recipe_ingredients for all
  using (exists (select 1 from public.recipes where recipes.id = recipe_ingredients.recipe_id and recipes.user_id = auth.uid()));
