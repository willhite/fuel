create table public.day_types (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  calories_min integer not null default 0,
  calories_max integer not null default 0,
  protein_min integer not null default 0,
  protein_max integer not null default 0,
  carbs_min integer not null default 0,
  carbs_max integer not null default 0,
  fat_min integer not null default 0,
  fat_max integer not null default 0,
  fiber_min integer not null default 0,
  fiber_max integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.day_types enable row level security;

create policy "Users can manage own day types"
  on public.day_types for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table public.day_logs (
  user_id uuid references public.profiles(id) on delete cascade not null,
  logged_date date not null,
  day_type_id uuid references public.day_types(id) on delete set null,
  primary key (user_id, logged_date)
);

alter table public.day_logs enable row level security;

create policy "Users can manage own day logs"
  on public.day_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
