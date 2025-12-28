"""
Main API router - Aggregates all v1 API routes.
"""

from fastapi import APIRouter

from app.api.v1 import auth, requests, users, clients, dashboard, portal

api_router = APIRouter()

# Include all route modules
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"]
)

api_router.include_router(
    requests.router,
    prefix="/requests",
    tags=["Requests"]
)

api_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"]
)

api_router.include_router(
    clients.router,
    prefix="/clients",
    tags=["Clients"]
)

api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["Dashboard"]
)

api_router.include_router(
    portal.router,
    prefix="/portal",
    tags=["Client Portal"]
)
