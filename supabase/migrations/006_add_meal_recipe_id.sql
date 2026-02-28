ALTER TABLE meals ADD COLUMN recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL;
