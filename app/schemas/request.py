"""
Pydantic schemas for Billing Request validation and serialization.
"""

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


# Enums matching the model
class AgencyIDEnum(str, Enum):
    ICS = "ICS"
    MSB = "MSB"
    VV = "VV"


class RequestTypeEnum(str, Enum):
    INSURANCE_COVERAGE_CLAIM = "insurance_coverage_claim"
    WRONG_INSURANCE_REFILE = "wrong_insurance_refile"
    AUTO_ACCIDENT_3RD_PARTY = "auto_accident_3rd_party"
    MEDICAID_MEDICARE_QUESTION = "medicaid_medicare_question"
    PAID_DIRECT_TO_PROVIDER = "paid_direct_to_provider"
    ON_PAYMENT_PLAN = "on_payment_plan"
    PAYMENT_POSTED_WRONG = "payment_posted_wrong"
    NOT_OUR_PATIENT = "not_our_patient"
    IDENTITY_THEFT_FRAUD = "identity_theft_fraud"
    ITEMIZED_BILL_REQUEST = "itemized_bill_request"
    VALIDATION_PACKAGE_REQUEST = "validation_package_request"
    STATEMENT_RESEND = "statement_resend"
    OVERCHARGED_BALANCE_INCORRECT = "overcharged_balance_incorrect"
    SERVICE_CANCELLED_NOT_BILLED = "service_cancelled_not_billed"


class RequestStatusEnum(str, Enum):
    OPEN = "OPEN"
    CLAIMED = "CLAIMED"
    SENT = "SENT"
    RESPONDED = "RESPONDED"
    CLOSED = "CLOSED"


class PriorityEnum(str, Enum):
    NORMAL = "NORMAL"
    HIGH = "HIGH"


class ResolutionCodeEnum(str, Enum):
    DEBT_VALID = "DEBT_VALID"
    BALANCE_ADJUSTED = "BALANCE_ADJUSTED"
    INSURANCE_PAID = "INSURANCE_PAID"
    PATIENT_PAID = "PATIENT_PAID"
    ACCOUNT_RECALLED = "ACCOUNT_RECALLED"
    IDENTITY_CONFIRMED_FRAUD = "IDENTITY_CONFIRMED_FRAUD"
    NO_CLIENT_RESPONSE = "NO_CLIENT_RESPONSE"
    DUPLICATE_CLOSED = "DUPLICATE_CLOSED"
    OTHER = "OTHER"


# Timeline event for audit trail
class TimelineEvent(BaseModel):
    """Single event in the request timeline."""
    id: str
    type: str  # created, status_change, assigned, comment, attachment, sent_to_client, client_response
    description: str
    timestamp: datetime
    user: Optional[str] = None
    metadata: Optional[dict] = None


# Attachment schema
class AttachmentResponse(BaseModel):
    """Attachment in API responses."""
    id: int
    filename: str
    original_filename: str
    mime_type: str
    size: int
    uploaded_by: Optional[int] = None
    uploaded_by_client: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Request schemas
class RequestBase(BaseModel):
    """Base schema for request data."""
    agency_id: AgencyIDEnum
    client_id: int
    account_reference: str = Field(..., min_length=1, max_length=100)
    internal_file_id: Optional[str] = Field(None, max_length=100)
    balance: Optional[str] = Field(None, max_length=50)  # CRM balance snapshot
    debtor_language: str = Field(default="EN", max_length=10)
    request_type: RequestTypeEnum
    required_fields_payload: dict = Field(default_factory=dict)
    notes: Optional[str] = Field(None, max_length=2000)
    priority: PriorityEnum = PriorityEnum.NORMAL


class RequestCreate(RequestBase):
    """Schema for creating a new request."""
    pass


class RequestUpdate(BaseModel):
    """Schema for updating a request."""
    notes: Optional[str] = Field(None, max_length=2000)
    required_fields_payload: Optional[dict] = None
    priority: Optional[PriorityEnum] = None


class RequestResponse(BaseModel):
    """Schema for request API responses."""
    id: int
    request_id: str
    agency_id: AgencyIDEnum
    client_id: int
    client_name: Optional[str] = None  # Populated from relationship
    account_reference: str
    internal_file_id: Optional[str] = None
    debtor_language: str
    collector_id: int
    collector_name: Optional[str] = None  # Populated from relationship
    assigned_admin_id: Optional[int] = None
    assigned_admin_name: Optional[str] = None  # Populated from relationship
    request_type: RequestTypeEnum
    required_fields_payload: dict
    notes: Optional[str] = None
    status: RequestStatusEnum
    priority: PriorityEnum
    hold_behavior: str
    created_at: datetime
    updated_at: datetime
    claimed_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    sla_due_at: Optional[datetime] = None
    sla_breached: bool = False
    resolution_code: Optional[ResolutionCodeEnum] = None
    resolution_notes: Optional[str] = None
    portal_token: Optional[str] = None
    portal_token_expires_at: Optional[datetime] = None
    attachments: List[AttachmentResponse] = []
    timeline: List[TimelineEvent] = []

    model_config = ConfigDict(from_attributes=True)


class RequestListResponse(BaseModel):
    """Schema for paginated list of requests."""
    items: List[RequestResponse]
    total: int
    page: int
    page_size: int
    pages: int


# Action schemas
class RequestClaimRequest(BaseModel):
    """Schema for claiming a request."""
    pass  # No additional data needed, uses authenticated user


class RequestSendRequest(BaseModel):
    """Schema for sending request to client."""
    recipient_email: Optional[str] = None  # Override client email if needed
    cc_email: Optional[str] = None  # CC email address
    message: Optional[str] = None  # Optional additional message


class RequestCloseRequest(BaseModel):
    """Schema for closing a request."""
    resolution_code: ResolutionCodeEnum
    resolution_notes: Optional[str] = Field(None, max_length=2000)


class NeedInfoRequest(BaseModel):
    """Schema for requesting more info from collector."""
    reason: str = Field(..., min_length=1, max_length=500, description="What info is needed")
    message: Optional[str] = Field(None, max_length=2000, description="Optional message to collector")


# Dedupe schemas
class DedupeCheckRequest(BaseModel):
    """Schema for checking duplicate requests."""
    account_reference: str
    request_type: RequestTypeEnum


class DedupeCheckResponse(BaseModel):
    """Response for dedupe check."""
    is_duplicate: bool
    existing_request_id: Optional[str] = None
    existing_status: Optional[str] = None
