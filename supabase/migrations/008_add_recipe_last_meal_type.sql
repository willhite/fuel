ALTER TABLE recipes ADD COLUMN last_meal_type text CHECK (last_meal_type IN ('Breakfast', 'Lunch', 'Dinner', 'Snack'));
