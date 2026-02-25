-- ============================================================
-- Migration 001 — Initial Schema (Phase 1)
-- ============================================================

create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  display_name text,
  calorie_goal integer not null default 2000,
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
  notes text,
  created_at timestamptz not null default now()
);

create index meals_user_date_idx on public.meals (user_id, logged_date desc);

alter table public.profiles enable row level security;
alter table public.meals enable row level security;

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can view own meals" on public.meals for select using (auth.uid() = user_id);
create policy "Users can insert own meals" on public.meals for insert with check (auth.uid() = user_id);
create policy "Users can update own meals" on public.meals for update using (auth.uid() = user_id);
create policy "Users can delete own meals" on public.meals for delete using (auth.uid() = user_id);
