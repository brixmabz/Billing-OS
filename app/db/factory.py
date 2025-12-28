"""
Database factory module.
Provides dependency injection for database sessions and repositories.
Supports switching between PostgreSQL and Supabase based on configuration.
"""

from typing import Generator, Any
from app.core.config import settings


def get_db() -> Generator[Any, None, None]:
    """
    Get database session based on configured provider.
    Use this as a FastAPI dependency.
    """
    if settings.DATABASE_PROVIDER == "supabase":
        from app.db.supabase.connection import get_supabase_client
        yield get_supabase_client()
    else:
        from app.db.postgres.connection import get_db_session
        yield from get_db_session()


def get_request_repository():
    """
    Get the request repository implementation based on configured provider.
    """
    if settings.DATABASE_PROVIDER == "supabase":
        from app.db.supabase.repositories import SupabaseRequestRepository
        return SupabaseRequestRepository()
    else:
        from app.db.postgres.repositories import PostgresRequestRepository
        return PostgresRequestRepository()


def get_user_repository():
    """
    Get the user repository implementation based on configured provider.
    """
    if settings.DATABASE_PROVIDER == "supabase":
        from app.db.supabase.repositories import SupabaseUserRepository
        return SupabaseUserRepository()
    else:
        from app.db.postgres.repositories import PostgresUserRepository
        return PostgresUserRepository()


def get_client_repository():
    """
    Get the client repository implementation based on configured provider.
    """
    if settings.DATABASE_PROVIDER == "supabase":
        from app.db.supabase.repositories import SupabaseClientRepository
        return SupabaseClientRepository()
    else:
        from app.db.postgres.repositories import PostgresClientRepository
        return PostgresClientRepository()
