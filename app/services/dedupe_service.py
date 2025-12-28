"""
Dedupe Service - Prevents duplicate billing requests.

Duplicate requests waste admin time and confuse clients. This service
generates unique keys based on account + request type and checks for
existing open requests before allowing new submissions.
"""

import hashlib
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.db.postgres.repositories import PostgresRequestRepository
from app.models.request import RequestStatus


class DedupeService:
    """
    Service for detecting and preventing duplicate requests.

    A request is considered a duplicate if:
    1. Same account_reference
    2. Same request_type
    3. Existing request is in OPEN, CLAIMED, or SENT status
    """

    # Statuses that count as "active" for deduplication
    ACTIVE_STATUSES = [
        RequestStatus.OPEN,
        RequestStatus.CLAIMED,
        RequestStatus.SENT,
    ]

    def __init__(self, db: Session):
        self.db = db
        self.repo = PostgresRequestRepository(db)

    def generate_dedupe_key(self, account_reference: str, request_type: str) -> str:
        """
        Generate a unique key for deduplication.

        The key is a hash of the account reference and request type,
        ensuring consistent key generation regardless of case or whitespace.

        Args:
            account_reference: The account number/reference
            request_type: The type of request

        Returns:
            A 16-character hex string
        """
        # Normalize inputs
        normalized_account = account_reference.strip().lower()
        normalized_type = request_type.strip().lower()

        # Create composite key
        raw = f"{normalized_account}:{normalized_type}"

        # Hash for consistent length and privacy
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    async def check_duplicate(
        self,
        account_reference: str,
        request_type: str
    ) -> Dict[str, Any]:
        """
        Check if a duplicate request already exists.

        Args:
            account_reference: The account number/reference
            request_type: The type of request

        Returns:
            Dictionary with:
            - is_duplicate: bool
            - existing_request_id: str or None
            - existing_status: str or None
            - message: str describing the result
        """
        dedupe_key = self.generate_dedupe_key(account_reference, request_type)

        existing = await self.repo.get_by_dedupe_key(dedupe_key)

        # Compare string status to enum values
        active_status_values = [s.value for s in self.ACTIVE_STATUSES]
        if existing and existing.status in active_status_values:
            return {
                "is_duplicate": True,
                "existing_request_id": existing.request_id,
                "existing_status": existing.status,
                "message": f"A similar request ({existing.request_id}) is already {existing.status.lower()}. "
                          f"Please check the existing request before creating a new one."
            }

        return {
            "is_duplicate": False,
            "existing_request_id": None,
            "existing_status": None,
            "message": "No duplicate found"
        }

    async def find_related_requests(
        self,
        account_reference: str,
        limit: int = 10
    ) -> list:
        """
        Find all requests for the same account.

        Useful for showing request history on an account.

        Args:
            account_reference: The account number/reference
            limit: Maximum number of requests to return

        Returns:
            List of related requests
        """
        requests = await self.repo.get_multi(
            filters={"account_reference": account_reference},
            limit=limit
        )
        return requests

    async def can_create_request(
        self,
        account_reference: str,
        request_type: str
    ) -> tuple[bool, Optional[str]]:
        """
        Check if a new request can be created.

        Args:
            account_reference: The account number/reference
            request_type: The type of request

        Returns:
            Tuple of (can_create, reason_if_blocked)
        """
        result = await self.check_duplicate(account_reference, request_type)

        if result["is_duplicate"]:
            return False, result["message"]

        return True, None


def generate_dedupe_key(account_reference: str, request_type: str) -> str:
    """
    Standalone function to generate dedupe key.
    Useful when you don't need the full service.
    """
    normalized_account = account_reference.strip().lower()
    normalized_type = request_type.strip().lower()
    raw = f"{normalized_account}:{normalized_type}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
