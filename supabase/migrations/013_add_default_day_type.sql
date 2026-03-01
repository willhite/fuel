ALTER TABLE public.profiles
  ADD COLUMN default_day_type_id uuid
    REFERENCES public.day_types(id) ON DELETE SET NULL;
