"""
AI Financial Planner - FastAPI Backend
Main application entry point
"""
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import users, auth
from routers import transactions
from routers import exchange_rates

app = FastAPI(
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
