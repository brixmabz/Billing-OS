"""
Pydantic schemas for authentication.
"""

from pydantic import BaseModel, Field
from typing import Optional
from app.schemas.user import UserResponse


class LoginRequest(BaseModel):
    """Schema for login request."""
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    remember_me: bool = False


class TokenResponse(BaseModel):
    """Schema for token response after login."""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int  # Seconds until expiration
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """Schema for refreshing access token."""
    refresh_token: str


class TokenPayload(BaseModel):
    """Schema for decoded JWT payload."""
    sub: str  # Subject (user ID)
    exp: int  # Expiration timestamp
    type: str  # Token type (access/refresh)
    role: Optional[str] = None  # User role
