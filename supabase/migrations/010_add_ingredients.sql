CREATE TABLE public.ingredients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  calories_per_100g numeric(8,2) not null default 0,
  protein_per_100g numeric(8,2) not null default 0,
  carbs_per_100g numeric(8,2) not null default 0,
  fat_per_100g numeric(8,2) not null default 0,
  fiber_per_100g numeric(8,2) not null default 0,
  usda_fdc_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

ALTER TABLE public.ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read ingredients"
  ON public.ingredients FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage ingredients"
  ON public.ingredients FOR ALL
  USING (auth.role() = 'authenticated');
