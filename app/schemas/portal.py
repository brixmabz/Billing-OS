"""
Pydantic schemas for Client Portal.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ClientResolutionType(str, Enum):
    """Client response resolution types."""
    # Client-oriented options
    DOCUMENTS_PROVIDED = "documents_provided"
    NEED_MORE_TIME = "need_more_time"
    DISPUTE = "dispute"
    PAYMENT_CONFIRMED = "payment_confirmed"
    # Admin-style resolution codes (also accepted from portal)
    DEBT_VALID = "DEBT_VALID"
    BALANCE_ADJUSTED = "BALANCE_ADJUSTED"
    INSURANCE_PAID = "INSURANCE_PAID"
    PATIENT_PAID = "PATIENT_PAID"
    ACCOUNT_RECALLED = "ACCOUNT_RECALLED"
    OTHER = "other"


class PortalValidateResponse(BaseModel):
    """Response for portal token validation."""
    is_valid: bool
    request_id: Optional[str] = None
    expires_at: Optional[datetime] = None
    error: Optional[str] = None


class PortalRequestInfo(BaseModel):
    """Limited request info shown to client in portal."""
    request_id: str
    request_type: str
    request_type_display: str  # Human-readable type name
    account_reference: str
    file_id: Optional[str] = None
    balance: Optional[str] = None
    inquiry_details: Optional[str] = None  # Non-PHI summary
    created_at: datetime
    status: str


class PortalRequestResponse(BaseModel):
    """Response containing request info for portal."""
    is_valid: bool
    request: Optional[PortalRequestInfo] = None
    client_name: Optional[str] = None
    expires_at: Optional[datetime] = None
    error: Optional[str] = None


class PortalRespondRequest(BaseModel):
    """Schema for client response via portal."""
    resolution: ClientResolutionType
    notes: Optional[str] = Field(None, max_length=2000)
    # Additional structured data based on resolution type
    payment_reference: Optional[str] = None  # For payment_confirmed
    insurance_info: Optional[dict] = None  # For insurance-related requests
    requested_extension_days: Optional[int] = Field(None, ge=1, le=30)  # For need_more_time


class PortalRespondResponse(BaseModel):
    """Response after client submits via portal."""
    success: bool
    message: str
    request_id: str


class PortalUploadResponse(BaseModel):
    """Response after file upload via portal."""
    success: bool
    filename: str
    file_id: int
    message: str
