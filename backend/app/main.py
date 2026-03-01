from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import meals, profile, usda, recipes, ingredients

app = FastAPI(title="Fuel API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meals.router)
app.include_router(profile.router)
app.include_router(usda.router)
app.include_router(recipes.router)
app.include_router(ingredients.router)


@app.get("/health")
def health():
    return {"status": "ok"}
