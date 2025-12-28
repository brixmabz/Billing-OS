"""
Billing Request OS - FastAPI Application Entry Point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    print(f"Starting {settings.APP_NAME}...")
    print(f"Database provider: {settings.DATABASE_PROVIDER}")

    # Initialize database tables (for PostgreSQL)
    if settings.DATABASE_PROVIDER == "postgres":
        from app.db.postgres.connection import init_db
        init_db()
        print("PostgreSQL tables initialized")

    yield

    # Shutdown
    print(f"Shutting down {settings.APP_NAME}...")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="Billing Request Management System",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "database_provider": settings.DATABASE_PROVIDER
    }


# Include API routers
from app.api.v1.router import api_router
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# ==============================================================================
# LEGACY ENDPOINT (keeping for backward compatibility during migration)
# Remove after migration is complete
# ==============================================================================
from fastapi import Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

# Import from old database module for backward compatibility
from database import SessionLocal, Request as LegacyRequest


class LegacyRequestCreate(BaseModel):
    client_id: str
    account_num: str
    request_type: str
    notes: str


def get_legacy_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.post("/api/submit-request")
def submit_request(request: LegacyRequestCreate, db: Session = Depends(get_legacy_db)):
    """
    LEGACY ENDPOINT - Kept for backward compatibility.
    Use /api/v1/requests POST instead.
    """
    print(f"[LEGACY] Received: {request.request_type}")

    # Default status
    new_status = "OPEN"

    # Auto-resolve logic
    if request.request_type in ["PIF Letter", "SIF Letter"]:
        new_status = "CLOSED"
        print(f"[LEGACY] AUTO: Generating {request.request_type}...")

    if request.request_type == "Dispute":
        new_status = "OPEN"
        print("[LEGACY] MANUAL: Dispute for Admin review.")

    # Save to database
    db_record = LegacyRequest(
        client_id=request.client_id,
        account_num=request.account_num,
        request_type=request.request_type,
        notes=request.notes,
        status=new_status
    )
    db.add(db_record)
    db.commit()

    return {"message": "Request logged", "status": new_status}


# ==============================================================================
# END LEGACY ENDPOINT
# ==============================================================================


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
