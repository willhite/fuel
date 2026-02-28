-- ============================================================
-- Fuel — Database Schema
-- Run this in Supabase SQL Editor to set up all tables
-- ============================================================

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  display_name text,
  calorie_goal integer not null default 2000,
  protein_goal integer not null default 150,
  carbs_goal integer not null default 250,
  fat_goal integer not null default 65,
  fiber_goal integer not null default 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.meals (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  logged_date date not null default current_date,
  meal_type text not null check (meal_type in ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  name text not null,
  calories integer not null check (calories >= 0),
  protein_g numeric(6,1) default 0,
  carbs_g numeric(6,1) default 0,
  fat_g numeric(6,1) default 0,
  fiber_g numeric(6,1) default 0,
  notes text,
  raw_weight numeric(7,1),
  total_cooked_weight numeric(7,1),
  portion_weight numeric(7,1),
  created_at timestamptz not null default now()
);

create index meals_user_date_idx on public.meals (user_id, logged_date desc);

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
  checked boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can view own meals" on public.meals for select using (auth.uid() = user_id);
create policy "Users can insert own meals" on public.meals for insert with check (auth.uid() = user_id);
create policy "Users can update own meals" on public.meals for update using (auth.uid() = user_id);
create policy "Users can delete own meals" on public.meals for delete using (auth.uid() = user_id);
create policy "Users can view own recipes" on public.recipes for select using (auth.uid() = user_id);
create policy "Users can insert own recipes" on public.recipes for insert with check (auth.uid() = user_id);
create policy "Users can update own recipes" on public.recipes for update using (auth.uid() = user_id);
create policy "Users can delete own recipes" on public.recipes for delete using (auth.uid() = user_id);
create policy "Users can manage ingredients of own recipes"
  on public.recipe_ingredients for all
  using (exists (select 1 from public.recipes where recipes.id = recipe_ingredients.recipe_id and recipes.user_id = auth.uid()));
