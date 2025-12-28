"""
Authentication service - Handles user authentication and token management.
"""

from typing import Optional, Tuple, Any, Union
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.db.factory import get_user_repository
from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.schemas.auth import TokenResponse
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.config import settings
from app.core.exceptions import UnauthorizedError, NotFoundError, ValidationError


def _get_attr(obj: Any, key: str, default: Any = None) -> Any:
    """Get attribute from object or dict."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _get_role_value(obj: Any) -> str:
    """Get role value from object or dict."""
    role = _get_attr(obj, 'role')
    if isinstance(role, UserRole):
        return role.value
    return role


class AuthService:
    """Service for authentication operations."""

    def __init__(self, db: Session):
        self.db = db
        self.user_repo = get_user_repository()

    async def authenticate(
        self,
        username: str,
        password: str
    ) -> Tuple[Any, str, str]:
        """
        Authenticate user and return user with tokens.
        Returns: (user, access_token, refresh_token)
        """
        # Find user
        user = await self.user_repo.get_by_username(username)
        if not user:
            raise UnauthorizedError("Invalid username or password")

        # Verify password
        hashed_password = _get_attr(user, 'hashed_password')
        if not verify_password(password, hashed_password):
            raise UnauthorizedError("Invalid username or password")

        # Check if user is active
        if not _get_attr(user, 'is_active'):
            raise UnauthorizedError("User account is disabled")

        # Update last login
        user_id = _get_attr(user, 'id')
        await self.user_repo.update(user_id, {"last_login_at": datetime.utcnow().isoformat()})

        # Generate tokens
        access_token = create_access_token(
            subject=user_id,
            additional_claims={"role": _get_role_value(user)}
        )
        refresh_token = create_refresh_token(subject=user_id)

        return user, access_token, refresh_token

    async def refresh_tokens(self, refresh_token: str) -> Tuple[str, str]:
        """
        Refresh access token using refresh token.
        Returns: (new_access_token, new_refresh_token)
        """
        payload = decode_token(refresh_token)
        if not payload:
            raise UnauthorizedError("Invalid refresh token")

        if payload.get("type") != "refresh":
            raise UnauthorizedError("Invalid token type")

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError("Invalid token payload")

        # Get user
        user = await self.user_repo.get(int(user_id))
        if not user or not _get_attr(user, 'is_active'):
            raise UnauthorizedError("User not found or inactive")

        # Generate new tokens
        uid = _get_attr(user, 'id')
        new_access_token = create_access_token(
            subject=uid,
            additional_claims={"role": _get_role_value(user)}
        )
        new_refresh_token = create_refresh_token(subject=uid)

        return new_access_token, new_refresh_token

    async def get_current_user(self, token: str) -> Any:
        """Get current user from access token."""
        payload = decode_token(token)
        if not payload:
            raise UnauthorizedError("Invalid access token")

        if payload.get("type") != "access":
            raise UnauthorizedError("Invalid token type")

        user_id = payload.get("sub")
        if not user_id:
            raise UnauthorizedError("Invalid token payload")

        user = await self.user_repo.get(int(user_id))
        if not user:
            raise UnauthorizedError("User not found")

        if not _get_attr(user, 'is_active'):
            raise UnauthorizedError("User account is disabled")

        return user

    async def create_user(self, user_data: UserCreate) -> Any:
        """Create a new user."""
        # Check if username exists
        existing = await self.user_repo.get_by_username(user_data.username)
        if existing:
            raise ValidationError(f"Username '{user_data.username}' already exists")

        # Check if email exists
        existing = await self.user_repo.get_by_email(user_data.email)
        if existing:
            raise ValidationError(f"Email '{user_data.email}' already exists")

        # Hash password
        hashed_password = get_password_hash(user_data.password)

        # Create user
        user_dict = user_data.model_dump(exclude={"password"})
        user_dict["hashed_password"] = hashed_password

        return await self.user_repo.create(user_dict)

    async def get_user_by_id(self, user_id: int) -> Any:
        """Get user by ID."""
        user = await self.user_repo.get(user_id)
        if not user:
            raise NotFoundError("User", str(user_id))
        return user

    async def change_password(
        self,
        user_id: int,
        current_password: str,
        new_password: str
    ) -> bool:
        """Change user's password."""
        user = await self.get_user_by_id(user_id)

        hashed_password = _get_attr(user, 'hashed_password')
        if not verify_password(current_password, hashed_password):
            raise UnauthorizedError("Current password is incorrect")

        new_hash = get_password_hash(new_password)
        await self.user_repo.update(user_id, {"hashed_password": new_hash})

        return True
