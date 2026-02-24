# Fuel — Calorie & Nutrition Tracker

A full-stack web app for tracking daily calorie intake, macros, and recipes. Built for personal use with friends and family.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite + Tailwind CSS |
| Backend | FastAPI (Python) |
| Database + Auth | Supabase (PostgreSQL) |
| Nutrition API | USDA FoodData Central |
| Hosting (FE) | Vercel / Netlify |
| Hosting (BE) | Railway / Render |

## Monorepo Structure

```
fuel/
├── frontend/         # React app
├── backend/          # FastAPI app
├── supabase/         # DB migrations and schema
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- A Supabase project (see supabase/SETUP.md)

### Frontend
```bash
cd frontend
npm install
cp .env.example .env        # fill in your Supabase values
npm run dev
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in your Supabase values
uvicorn app.main:app --reload
```

## Features (Roadmap)

- [x] Phase 1 — Auth + daily calorie logging + cross-device sync
- [ ] Phase 2 — Macro tracking (protein, carbs, fat, fiber)
- [ ] Phase 3 — Recipe builder with USDA ingredient lookup
- [ ] Phase 4 — History, insights, and weekly trends
