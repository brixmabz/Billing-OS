"""
BillingRequest model - Core data model for the Billing Request OS.
"""

from sqlalchemy import (
    Column, String, Integer, DateTime, Boolean, JSON, Text,
    ForeignKey, Index
)
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.db.postgres.connection import Base


class AgencyID(str, enum.Enum):
    """Agency identifiers."""
    ICS = "ICS"
    MSB = "MSB"
    VV = "VV"


class RequestType(str, enum.Enum):
    """
    All 14 request types from the PRD, organized by category.
    """
    # Category 1: Insurance / Billing
    INSURANCE_COVERAGE_CLAIM = "insurance_coverage_claim"
    WRONG_INSURANCE_REFILE = "wrong_insurance_refile"
    AUTO_ACCIDENT_3RD_PARTY = "auto_accident_3rd_party"
    MEDICAID_MEDICARE_QUESTION = "medicaid_medicare_question"

    # Category 2: Payment
    PAID_DIRECT_TO_PROVIDER = "paid_direct_to_provider"
    ON_PAYMENT_PLAN = "on_payment_plan"
    PAYMENT_POSTED_WRONG = "payment_posted_wrong"

    # Category 3: Identity / Validity
    NOT_OUR_PATIENT = "not_our_patient"
    IDENTITY_THEFT_FRAUD = "identity_theft_fraud"

    # Category 4: Documentation
    ITEMIZED_BILL_REQUEST = "itemized_bill_request"
    VALIDATION_PACKAGE_REQUEST = "validation_package_request"
    STATEMENT_RESEND = "statement_resend"

    # Category 5: Charge Dispute
    OVERCHARGED_BALANCE_INCORRECT = "overcharged_balance_incorrect"
    SERVICE_CANCELLED_NOT_BILLED = "service_cancelled_not_billed"


class RequestStatus(str, enum.Enum):
    """Request workflow statuses."""
    OPEN = "OPEN"           # Newly created, waiting to be claimed
    CLAIMED = "CLAIMED"     # Admin has claimed, not yet sent
    SENT = "SENT"           # Sent to client, awaiting response
    RESPONDED = "RESPONDED" # Client has responded
    CLOSED = "CLOSED"       # Request resolved


class Priority(str, enum.Enum):
    """Request priority levels."""
    NORMAL = "NORMAL"
    HIGH = "HIGH"


class HoldBehavior(str, enum.Enum):
    """How the request affects collection activity."""
    HARD_HOLD = "hard_hold"   # Stop all collection activity
    SOFT_HOLD = "soft_hold"   # Continue with modified script
    NO_HOLD = "no_hold"       # Continue collecting normally


class ResolutionCode(str, enum.Enum):
    """Resolution codes for closed requests."""
    DEBT_VALID = "DEBT_VALID"                     # Debt confirmed, collection continues
    BALANCE_ADJUSTED = "BALANCE_ADJUSTED"         # Client adjusted balance
    INSURANCE_PAID = "INSURANCE_PAID"             # Insurance covered balance
    PATIENT_PAID = "PATIENT_PAID"                 # Payment found/posted
    ACCOUNT_RECALLED = "ACCOUNT_RECALLED"         # Client recalled account
    IDENTITY_CONFIRMED_FRAUD = "IDENTITY_CONFIRMED_FRAUD"  # Verified identity theft
    NO_CLIENT_RESPONSE = "NO_CLIENT_RESPONSE"     # Expired without response
    DUPLICATE_CLOSED = "DUPLICATE_CLOSED"         # Merged with existing request
    OTHER = "OTHER"                               # Other resolution


class BillingRequest(Base):
    """
    Main billing request model.
    Stores all request data, status, and audit trail.
    """
    __tablename__ = "billing_requests"

    # Primary identifiers
    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(10), unique=True, index=True, nullable=False)  # REQ-0001 format

    # Agency and client info
    agency_id = Column(String(10), nullable=False, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    account_reference = Column(String(100), nullable=False, index=True)
    internal_file_id = Column(String(100), index=True)

    # Debtor info (non-PHI)
    debtor_language = Column(String(10), default="EN")

    # Request ownership
    collector_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_admin_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Request details
    request_type = Column(String(50), nullable=False, index=True)
    required_fields_payload = Column(JSON, default=dict)  # Dynamic fields based on type
    notes = Column(Text, nullable=True)  # Free-text notes (PHI-scanned)

    # Status tracking
    status = Column(String(20), default="OPEN", nullable=False, index=True)
    priority = Column(String(10), default="NORMAL", nullable=False)
    hold_behavior = Column(String(20), default="soft_hold", nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    claimed_at = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    responded_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    # SLA tracking
    sla_due_at = Column(DateTime, nullable=True)
    sla_breached = Column(Boolean, default=False, index=True)

    # Deduplication
    dedupe_key = Column(String(64), index=True)  # Hash of account_reference + request_type

    # Resolution
    resolution_code = Column(String(50), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    # Client response
    client_response_payload = Column(JSON, nullable=True)  # Structured response from client

    # Portal
    portal_token = Column(String(64), nullable=True, unique=True)
    portal_token_expires_at = Column(DateTime, nullable=True)

    # Slack
    slack_message_ts = Column(String(50), nullable=True)  # Slack message timestamp for threading
    slack_channel_id = Column(String(50), nullable=True)

    # Audit trail (immutable event log)
    audit_log = Column(JSON, default=list)

    # Relationships
    client = relationship("Client", back_populates="requests")
    collector = relationship("User", foreign_keys=[collector_id], back_populates="created_requests")
    assigned_admin = relationship("User", foreign_keys=[assigned_admin_id], back_populates="assigned_requests")
    attachments = relationship("Attachment", back_populates="request", cascade="all, delete-orphan")

    # Indexes for common queries
    __table_args__ = (
        Index('ix_billing_requests_status_created', 'status', 'created_at'),
        Index('ix_billing_requests_collector_status', 'collector_id', 'status'),
        Index('ix_billing_requests_admin_status', 'assigned_admin_id', 'status'),
        Index('ix_billing_requests_client_status', 'client_id', 'status'),
        Index('ix_billing_requests_sla_breach', 'sla_breached', 'sla_due_at'),
    )

    def __repr__(self):
        return f"<BillingRequest {self.request_id} ({self.status})>"

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "request_id": self.request_id,
            "agency_id": self.agency_id,
            "client_id": self.client_id,
            "account_reference": self.account_reference,
            "internal_file_id": self.internal_file_id,
            "debtor_language": self.debtor_language,
            "collector_id": self.collector_id,
            "assigned_admin_id": self.assigned_admin_id,
            "request_type": self.request_type,
            "required_fields_payload": self.required_fields_payload,
            "notes": self.notes,
            "status": self.status,
            "priority": self.priority,
            "hold_behavior": self.hold_behavior,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "claimed_at": self.claimed_at.isoformat() if self.claimed_at else None,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "responded_at": self.responded_at.isoformat() if self.responded_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "sla_due_at": self.sla_due_at.isoformat() if self.sla_due_at else None,
            "sla_breached": self.sla_breached,
            "resolution_code": self.resolution_code,
            "resolution_notes": self.resolution_notes,
        }


# Request type configuration - defines required fields and behavior per type
REQUEST_TYPE_CONFIG = {
    RequestType.INSURANCE_COVERAGE_CLAIM: {
        "category": "Insurance/Billing",
        "hold_behavior": HoldBehavior.SOFT_HOLD,
        "required_fields": ["payer_name", "policy_id_provided", "coverage_type"],
        "sla_hours": 72,
        "is_external": True,
        "description": "Patient claims insurance coverage"
    },
    RequestType.WRONG_INSURANCE_REFILE: {
        "category": "Insurance/Billing",
        "hold_behavior": HoldBehavior.SOFT_HOLD,
        "required_fields": ["current_payer", "correct_payer", "refile_reason"],
        "sla_hours": 72,
        "is_external": True,
        "description": "Insurance was filed to wrong payer"
    },
    RequestType.AUTO_ACCIDENT_3RD_PARTY: {
        "category": "Insurance/Billing",
        "hold_behavior": HoldBehavior.HARD_HOLD,
        "required_fields": ["accident_date", "insurance_carrier", "claim_number"],
        "sla_hours": 72,
        "is_external": True,
        "description": "Auto accident or third party liability claim"
    },
    RequestType.MEDICAID_MEDICARE_QUESTION: {
        "category": "Insurance/Billing",
        "hold_behavior": HoldBehavior.SOFT_HOLD,
        "required_fields": ["coverage_type", "eligibility_dates_claimed"],
        "sla_hours": 72,
        "is_external": True,
        "description": "Question about Medicaid/Medicare coverage"
    },
    RequestType.PAID_DIRECT_TO_PROVIDER: {
        "category": "Payment",
        "hold_behavior": HoldBehavior.SOFT_HOLD,
        "required_fields": ["payment_date", "payment_amount", "payment_method", "proof_offered"],
        "sla_hours": 48,
        "is_external": True,
        "description": "Patient claims payment was made directly to provider"
    },
    RequestType.ON_PAYMENT_PLAN: {
        "category": "Payment",
        "hold_behavior": HoldBehavior.HARD_HOLD,
        "required_fields": ["plan_start_date", "monthly_amount", "provider_contact"],
        "sla_hours": 48,
        "is_external": True,
        "description": "Patient claims active payment plan with provider"
    },
    RequestType.PAYMENT_POSTED_WRONG: {
        "category": "Payment",
        "hold_behavior": HoldBehavior.SOFT_HOLD,
        "required_fields": ["payment_date", "payment_amount", "where_posted", "where_should_be"],
        "sla_hours": 48,
        "is_external": True,
        "description": "Payment was posted to wrong account"
    },
    RequestType.NOT_OUR_PATIENT: {
        "category": "Identity/Validity",
        "hold_behavior": HoldBehavior.HARD_HOLD,
        "required_fields": ["id_verification_status", "debtor_claim"],
        "sla_hours": 72,
        "is_external": True,
        "description": "Person claims they are not the patient"
    },
    RequestType.IDENTITY_THEFT_FRAUD: {
        "category": "Identity/Validity",
        "hold_behavior": HoldBehavior.HARD_HOLD,
        "required_fields": ["id_verification_status", "fraud_affidavit_offered"],
        "sla_hours": 72,
        "is_external": True,
        "description": "Identity theft or fraud claim"
    },
    RequestType.ITEMIZED_BILL_REQUEST: {
        "category": "Documentation",
        "hold_behavior": HoldBehavior.SOFT_HOLD,
        "required_fields": ["delivery_preference"],
        "sla_hours": 24,
        "is_external": False,  # Can be auto-generated
        "description": "Request for itemized bill"
    },
    RequestType.VALIDATION_PACKAGE_REQUEST: {
        "category": "Documentation",
        "hold_behavior": HoldBehavior.HARD_HOLD,
        "required_fields": ["delivery_preference", "request_reason"],
        "sla_hours": 720,  # 30 days per FDCPA
        "is_external": False,
        "description": "Debt validation request (30-day window)"
    },
    RequestType.STATEMENT_RESEND: {
        "category": "Documentation",
        "hold_behavior": HoldBehavior.NO_HOLD,
        "required_fields": ["delivery_preference", "address_verified"],
        "sla_hours": 24,
        "is_external": False,  # Can be auto-generated
        "description": "Request to resend statement"
    },
    RequestType.OVERCHARGED_BALANCE_INCORRECT: {
        "category": "Charge Dispute",
        "hold_behavior": HoldBehavior.SOFT_HOLD,
        "required_fields": ["dispute_type", "expected_balance"],
        "sla_hours": 72,
        "is_external": True,
        "description": "Dispute about overcharge or incorrect balance"
    },
    RequestType.SERVICE_CANCELLED_NOT_BILLED: {
        "category": "Charge Dispute",
        "hold_behavior": HoldBehavior.HARD_HOLD,
        "required_fields": ["cancellation_date", "cancellation_reason", "reference_number"],
        "sla_hours": 72,
        "is_external": True,
        "description": "Service was cancelled and should not be billed"
    },
}


def get_request_type_config(request_type: RequestType) -> dict:
    """Get configuration for a specific request type."""
    return REQUEST_TYPE_CONFIG.get(request_type, {})
