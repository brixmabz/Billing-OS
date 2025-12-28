"""
API Dependencies - Dependency injection for FastAPI endpoints.
"""

from typing import Generator, Optional, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.db.postgres.connection import SessionLocal
from app.models.user import User, UserRole
from app.services.auth_service import AuthService
from app.core.exceptions import UnauthorizedError


# Security scheme
security = HTTPBearer()


def _get_attr(obj: Any, key: str, default: Any = None) -> Any:
    """Get attribute from object or dict (handles both Supabase dict and ORM model)."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def get_db() -> Generator[Session, None, None]:
    """
    Database session dependency.
    Yields a database session and ensures cleanup.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get the current authenticated user from the JWT token.
    """
    token = credentials.credentials
    auth_service = AuthService(db)

    try:
        user = await auth_service.get_current_user(token)
        return user
    except UnauthorizedError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e.detail),
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get the current user and verify they are active.
    """
    if not _get_attr(current_user, 'is_active'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


def require_role(*roles: UserRole):
    """
    Dependency factory that requires user to have one of the specified roles.
    Usage: Depends(require_role(UserRole.ADMIN, UserRole.SUPERVISOR))
    """
    async def role_checker(
        current_user: User = Depends(get_current_active_user)
    ) -> User:
        user_role = _get_attr(current_user, 'role')
        # Handle both enum and string role values
        role_values = [r.value if isinstance(r, UserRole) else r for r in roles]
        user_role_value = user_role.value if isinstance(user_role, UserRole) else user_role
        if user_role_value not in role_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {', '.join(str(r.value if isinstance(r, UserRole) else r) for r in roles)}"
            )
        return current_user

    return role_checker


# Convenience dependencies for common role checks
async def get_collector_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Any active user can act as collector."""
    return current_user


async def get_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Require admin or supervisor role."""
    user_role = _get_attr(current_user, 'role')
    user_role_value = user_role.value if isinstance(user_role, UserRole) else user_role
    if user_role_value not in [UserRole.ADMIN.value, UserRole.SUPERVISOR.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_supervisor_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Require supervisor role."""
    user_role = _get_attr(current_user, 'role')
    user_role_value = user_role.value if isinstance(user_role, UserRole) else user_role
    if user_role_value != UserRole.SUPERVISOR.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supervisor access required"
        )
    return current_user
