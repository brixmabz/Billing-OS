"""
Portal Service - Manages client portal access tokens and sessions.

The client portal allows healthcare providers to respond to billing
requests securely without logging into the main system.
"""

import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.db.postgres.repositories import PostgresRequestRepository
from app.models.request import BillingRequest, RequestStatus
from app.core.config import settings
from app.core.exceptions import NotFoundError, ValidationError


class PortalService:
    """
    Service for managing client portal access.
    """

    def __init__(self, db: Session):
        self.db = db
        self.repo = PostgresRequestRepository(db)

    def generate_portal_token(self) -> str:
        """
        Generate a secure, URL-safe token for portal access.

        Returns:
            A 43-character URL-safe token
        """
        return secrets.token_urlsafe(32)

    def get_portal_url(self, token: str) -> str:
        """
        Get the full portal URL for a token.

        Args:
            token: The portal access token

        Returns:
            Full URL to the portal
        """
        return f"{settings.PORTAL_BASE_URL}/{token}"

    async def create_portal_session(
        self,
        request_id: str,
        expiry_hours: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Create a portal session for a request.

        Args:
            request_id: The formatted request ID (REQ-####)
            expiry_hours: Hours until token expires (default from settings)

        Returns:
            Dictionary with token, url, and expiration info
        """
        request = await self.repo.get_by_request_id(request_id)
        if not request:
            raise NotFoundError("Request", request_id)

        # Only allow portal creation for SENT requests
        if request.status != RequestStatus.SENT.value:
            raise ValidationError(
                f"Cannot create portal session for request in status {request.status}"
            )

        # Generate token and expiration
        token = self.generate_portal_token()
        hours = expiry_hours or settings.PORTAL_TOKEN_EXPIRY_HOURS
        expires_at = datetime.utcnow() + timedelta(hours=hours)

        # Save to request
        await self.repo.update(request.id, {
            "portal_token": token,
            "portal_token_expires_at": expires_at
        })

        return {
            "token": token,
            "url": self.get_portal_url(token),
            "expires_at": expires_at.isoformat(),
            "expires_in_hours": hours,
            "request_id": request_id
        }

    async def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate a portal token.

        Args:
            token: The portal access token

        Returns:
            Validation result with request info if valid
        """
        request = await self.repo.get_by_portal_token(token)

        if not request:
            return {
                "is_valid": False,
                "error": "Invalid or expired token"
            }

        # Check expiration
        if request.portal_token_expires_at:
            if request.portal_token_expires_at < datetime.utcnow():
                return {
                    "is_valid": False,
                    "error": "Token has expired",
                    "expired_at": request.portal_token_expires_at.isoformat()
                }

        # Check if request is in valid status
        valid_statuses = [RequestStatus.SENT.value, RequestStatus.RESPONDED.value]
        if request.status not in valid_statuses:
            return {
                "is_valid": False,
                "error": f"Request is not awaiting response (status: {request.status})"
            }

        return {
            "is_valid": True,
            "request_id": request.request_id,
            "expires_at": request.portal_token_expires_at.isoformat() if request.portal_token_expires_at else None,
            "status": request.status
        }

    async def invalidate_token(self, request_id: str) -> bool:
        """
        Invalidate the portal token for a request.

        Use this when closing a request or for security purposes.

        Args:
            request_id: The formatted request ID (REQ-####)

        Returns:
            True if token was invalidated
        """
        request = await self.repo.get_by_request_id(request_id)
        if not request:
            raise NotFoundError("Request", request_id)

        await self.repo.update(request.id, {
            "portal_token": None,
            "portal_token_expires_at": None
        })

        return True

    async def extend_token(
        self,
        token: str,
        additional_hours: int = 24
    ) -> Dict[str, Any]:
        """
        Extend the expiration of a portal token.

        Args:
            token: The portal access token
            additional_hours: Hours to add to expiration

        Returns:
            Updated token info
        """
        request = await self.repo.get_by_portal_token(token)
        if not request:
            raise NotFoundError("Portal session", token)

        new_expiry = datetime.utcnow() + timedelta(hours=additional_hours)

        await self.repo.update(request.id, {
            "portal_token_expires_at": new_expiry
        })

        return {
            "token": token,
            "url": self.get_portal_url(token),
            "expires_at": new_expiry.isoformat(),
            "request_id": request.request_id
        }

    async def get_portal_request_info(self, token: str) -> Optional[Dict[str, Any]]:
        """
        Get request information for the portal (PHI-safe).

        Only returns information that's safe to display to the client.

        Args:
            token: The portal access token

        Returns:
            PHI-safe request information
        """
        validation = await self.validate_token(token)
        if not validation["is_valid"]:
            return None

        request = await self.repo.get_by_portal_token(token)
        if not request:
            return None

        # Return only PHI-safe information
        return {
            "request_id": request.request_id,
            "request_type": request.request_type,
            "account_reference": request.account_reference,
            "created_at": request.created_at.isoformat(),
            "status": request.status,
            "client_name": request.client.name if request.client else None,
            "has_responded": request.status == RequestStatus.RESPONDED.value,
            "expires_at": request.portal_token_expires_at.isoformat() if request.portal_token_expires_at else None
        }
