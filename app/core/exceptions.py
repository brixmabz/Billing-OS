from fastapi import HTTPException, status
from typing import Any, Optional


class BillingOSException(HTTPException):
    """Base exception for Billing OS."""

    def __init__(
        self,
        status_code: int,
        detail: str,
        headers: Optional[dict[str, Any]] = None
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)


class DuplicateRequestError(BillingOSException):
    """Raised when a duplicate request is detected."""

    def __init__(self, existing_request_id: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Duplicate request detected. Existing request: {existing_request_id}"
        )
        self.existing_request_id = existing_request_id


class PHIDetectedError(BillingOSException):
    """Raised when PHI is detected in free-text fields."""

    def __init__(self, violations: list[str]):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"PHI detected in submission. Please remove: {', '.join(violations)}"
        )
        self.violations = violations


class SLABreachError(BillingOSException):
    """Raised when SLA breach is detected."""

    def __init__(self, breach_types: list[str]):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SLA breach detected: {', '.join(breach_types)}"
        )
        self.breach_types = breach_types


class NotFoundError(BillingOSException):
    """Raised when a resource is not found."""

    def __init__(self, resource: str, identifier: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource} not found: {identifier}"
        )


class UnauthorizedError(BillingOSException):
    """Raised when user is not authorized."""

    def __init__(self, detail: str = "Not authorized"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )


class ForbiddenError(BillingOSException):
    """Raised when user does not have permission."""

    def __init__(self, detail: str = "Permission denied"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )


class ValidationError(BillingOSException):
    """Raised when request validation fails."""

    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail
        )


class EmailValidationError(BillingOSException):
    """Raised when email validation fails (e.g., client email mismatch)."""

    def __init__(self, detail: str = "Email address does not match client record"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )
