from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import os
from dotenv import load_dotenv
from pathlib import Path
from auth.router import router as auth_router
from routers.project_router import router as project_router
from routers.task_router import router as task_router
from routers.ai_router import router as ai_router

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

app = FastAPI(title="Smart Task & Project Management System")


def _normalize_origin(origin: str) -> str:
    return origin.strip().rstrip("/")


def _get_cors_origins() -> list[str]:
    # Prefer CORS_ORIGINS for deployed environments. Example:
    # CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
    raw_origins = os.getenv("CORS_ORIGINS", "")
    if raw_origins.strip():
        origins = [_normalize_origin(origin) for origin in raw_origins.split(",") if origin.strip()]
        if origins:
            return origins

    # Backward-compatible fallback.
    single_origin = os.getenv("CORS_ORIGIN", "http://localhost:3000")
    return [_normalize_origin(single_origin)]


cors_origins = _get_cors_origins()
cors_origin_regex = os.getenv("CORS_ORIGIN_REGEX")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(project_router)
app.include_router(task_router)
app.include_router(ai_router)

@app.get("/")

def read_root():
    return {"message": "Welcome to STPMS API"}
