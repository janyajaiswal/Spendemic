"""
AI Financial Planner - FastAPI Backend
Main application entry point
"""
import os
import sys
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import users, auth
from routers import transactions
from routers import exchange_rates
from routers import budgets
from routers import alerts
from routers import forecast_context
from routers import forecast
from routers import import_transactions
from routers import jobs
from routers import goals
from routers import faq
from routers import chat

# ---------------------------------------------------------------------------
# Load the Chronos-2 model once at startup (background thread so the server
# is immediately reachable while the ~500 MB model finishes loading)
# ---------------------------------------------------------------------------

def _load_ml_model_bg() -> None:
    _ml_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ml_models"))
    if _ml_path not in sys.path:
        sys.path.insert(0, _ml_path)
    try:
        import chronos_model
        chronos_model.load_model()
    except Exception as exc:
        print(f"[startup] WARNING: Chronos-2 model failed to load: {exc}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    t = threading.Thread(target=_load_ml_model_bg, daemon=True)
    t.start()
    yield


app = FastAPI(
    lifespan=lifespan,
    title="AI Financial Planner API",
    description="API for international student budgeting with time-series forecasting",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default
        "http://localhost:5174",  # Project-configured Vite port
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router)
app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(exchange_rates.router)
app.include_router(budgets.router)
app.include_router(alerts.router)
app.include_router(forecast_context.router)
app.include_router(forecast.router)
app.include_router(import_transactions.router)
app.include_router(jobs.router)
app.include_router(goals.router)
app.include_router(faq.router)
app.include_router(chat.router)

# Serve uploaded files (avatars, etc.)
_uploads_dir = Path(__file__).parent / "uploads"
_uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AI Financial Planner API",
        "version": "1.0.0",
        "docs": "/api/docs"
    }

@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
