ALTER TABLE public.ingredients
  ADD COLUMN upc text,
  ADD COLUMN source text,        -- 'usda' | 'open_food_facts' | 'manual'
  ADD COLUMN source_name text;   -- exact product name from the source database
