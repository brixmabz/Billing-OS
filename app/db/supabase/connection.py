"""
Supabase client connection module.
"""

from typing import Optional
from functools import lru_cache

from app.core.config import settings

# Supabase client instance (lazy loaded)
_supabase_client = None


@lru_cache()
def get_supabase_client():
    """
    Get or create Supabase client instance.
    Uses service key for backend operations (bypasses RLS).
    """
    global _supabase_client

    if _supabase_client is None:
        try:
            from supabase import create_client, Client

            # Use service key for backend (bypasses Row Level Security)
            key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_KEY

            if not settings.SUPABASE_URL or not key:
                raise ValueError(
                    "SUPABASE_URL and SUPABASE_KEY must be set when using Supabase provider"
                )

            _supabase_client = create_client(
                settings.SUPABASE_URL,
                key
            )
        except ImportError:
            raise ImportError(
                "supabase package is not installed. "
                "Install it with: pip install supabase"
            )

    return _supabase_client


def reset_client() -> None:
    """Reset the client (useful for testing)."""
    global _supabase_client
    _supabase_client = None
    get_supabase_client.cache_clear()


# Alias for convenience
supabase_client = get_supabase_client
