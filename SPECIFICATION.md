# Fuel — Application Specification

## Overview
A full-stack web application for tracking daily calorie and nutrition intake. Built for personal use with a small group of friends and family.

---

## Users
- Primary user plus a small group (family/friends)
- Each user has their own private data
- Access via email/password authentication

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + Tailwind CSS (PWA) |
| Backend | FastAPI (Python) |
| Database + Auth | Supabase (PostgreSQL) |
| Nutrition API | USDA FoodData Central (Phase 3) |
| Hosting (Frontend) | Vercel or Netlify |
| Hosting (Backend) | Railway or Render |
| Source Control | GitHub (monorepo) |

---

## Features

### Phase 1 — Foundation ✅ Complete
- Email/password authentication (login + signup)
- Log meals by name, calorie count, and meal type (Breakfast, Lunch, Dinner, Snack)
- Daily calorie progress bar with goal tracking
- Navigate between days to view past entries
- Delete meal entries
- 7-day history view
- Cross-device sync via Supabase backend
- Per-user daily calorie goal

### Phase 2 — Macro Tracking
- Add macro fields to every meal entry:
  - Protein (g)
  - Carbohydrates (g)
  - Fat (g)
  - Fiber (g)
- Display macro totals on the dashboard
- Per-user macro goals (alongside calorie goal)

### Phase 3 — Recipe Builder
- Create and save named recipes with multiple ingredients
- Search ingredients via USDA FoodData Central API
- Specify quantity and unit per ingredient
- Auto-calculate total calories and macros for the recipe
- Save recipes to a personal library
- Log a saved recipe as a single meal entry

### Phase 4 — History & Insights
- Browse full history of past days
- Weekly calorie and macro averages
- Trend charts over time

---

## Data Model

### profiles
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | Links to Supabase auth user |
| email | text | |
| display_name | text | Optional |
| calorie_goal | integer | Default 2000 |
| protein_goal | integer | Default 150g |
| carbs_goal | integer | Default 250g |
| fat_goal | integer | Default 65g |
| fiber_goal | integer | Default 30g |

### meals
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | |
| user_id | uuid | FK to profiles |
| logged_date | date | |
| meal_type | text | Breakfast / Lunch / Dinner / Snack |
| name | text | |
| calories | integer | |
| protein_g | numeric | |
| carbs_g | numeric | |
| fat_g | numeric | |
| fiber_g | numeric | |
| notes | text | Optional |

### recipes
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | |
| user_id | uuid | FK to profiles |
| name | text | |
| description | text | Optional |
| servings | integer | |

### recipe_ingredients
| Field | Type | Notes |
|-------|------|-------|
| id | uuid | |
| recipe_id | uuid | FK to recipes |
| food_name | text | |
| quantity | numeric | |
| unit | text | |
| calories_per_unit | numeric | |
| protein_per_unit | numeric | |
| carbs_per_unit | numeric | |
| fat_per_unit | numeric | |
| fiber_per_unit | numeric | |
| usda_fdc_id | text | Optional, from USDA API lookup |

---

## Non-Functional Requirements
- Mobile-friendly / responsive design (PWA)
- Data private per user via Row Level Security (RLS) in Supabase
- Monorepo structure: `fuel/frontend` + `fuel/backend` + `fuel/supabase`
