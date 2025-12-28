"""
Request service - Business logic for billing requests.
"""

from typing import Optional, List, Tuple
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import hashlib
import uuid

from app.db.postgres.repositories import PostgresRequestRepository
from app.models.request import (
    BillingRequest, RequestStatus, RequestType, Priority,
    REQUEST_TYPE_CONFIG, get_request_type_config
)
from app.schemas.request import RequestCreate, RequestUpdate, RequestCloseRequest
from app.core.exceptions import (
    DuplicateRequestError, PHIDetectedError, NotFoundError, ValidationError
)
from app.core.config import settings


class RequestService:
    """Service for managing billing requests."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = PostgresRequestRepository(db)

    async def create_request(
        self,
        request_data: RequestCreate,
        collector_id: int
    ) -> BillingRequest:
        """
        Create a new billing request.
        Handles validation, deduplication, and auto-routing.
        """
        # 1. Validate required fields for request type
        self._validate_required_fields(request_data)

        # 2. Check for PHI in notes
        if request_data.notes:
            self._check_phi(request_data.notes)

        # 3. Generate dedupe key and check for duplicates
        dedupe_key = self._generate_dedupe_key(
            request_data.account_reference,
            request_data.request_type
        )
        existing = await self.repo.get_by_dedupe_key(dedupe_key)
        if existing:
            raise DuplicateRequestError(existing.request_id)

        # 4. Get request type configuration
        type_config = get_request_type_config(RequestType(request_data.request_type))

        # 5. Calculate SLA due date
        sla_hours = type_config.get("sla_hours", 72)
        sla_due_at = datetime.utcnow() + timedelta(hours=sla_hours)

        # 6. Generate request ID
        seq_num = await self.repo.get_next_sequence_number()
        request_id = f"REQ-{seq_num:04d}"

        # 7. Determine initial status (auto-resolve internal requests)
        initial_status = RequestStatus.OPEN
        if not type_config.get("is_external", True):
            # Internal requests can be auto-resolved
            # For now, still set to OPEN - auto-generation logic will be in integration layer
            pass

        # 8. Create the request
        # Extract string values from enums for Supabase compatibility
        def get_enum_value(val):
            return val.value if hasattr(val, 'value') else val

        request_dict = {
            "request_id": request_id,
            "agency_id": get_enum_value(request_data.agency_id),
            "client_id": request_data.client_id,
            "account_reference": request_data.account_reference,
            "internal_file_id": request_data.internal_file_id,
            "debtor_language": request_data.debtor_language,
            "collector_id": collector_id,
            "request_type": get_enum_value(request_data.request_type),
            "required_fields_payload": request_data.required_fields_payload,
            "notes": request_data.notes,
            "status": get_enum_value(initial_status),
            "priority": get_enum_value(request_data.priority),
            "hold_behavior": get_enum_value(type_config.get("hold_behavior", "soft_hold")),
            "dedupe_key": dedupe_key,
            "sla_due_at": sla_due_at,
            "audit_log": [{
                "id": str(uuid.uuid4()),
                "type": "created",
                "description": "Request created",
                "timestamp": datetime.utcnow().isoformat(),
                "user": str(collector_id),
            }],
        }

        return await self.repo.create(request_dict)

    async def get_request(self, request_id: str) -> Optional[BillingRequest]:
        """Get a request by its formatted ID (REQ-####)."""
        request = await self.repo.get_by_request_id(request_id)
        if not request:
            raise NotFoundError("Request", request_id)
        return request

    async def get_request_by_id(self, id: int) -> Optional[BillingRequest]:
        """Get a request by database ID."""
        return await self.repo.get(id)

    async def list_requests(
        self,
        skip: int = 0,
        limit: int = 50,
        status: Optional[str] = None,
        collector_id: Optional[int] = None,
        client_id: Optional[int] = None,
        sla_breached: Optional[bool] = None,
    ) -> Tuple[List[BillingRequest], int]:
        """List requests with filtering and pagination."""
        filters = {}
        if status:
            filters["status"] = status
        if collector_id:
            filters["collector_id"] = collector_id
        if client_id:
            filters["client_id"] = client_id
        if sla_breached is not None:
            filters["sla_breached"] = sla_breached

        requests = await self.repo.get_multi(skip=skip, limit=limit, filters=filters)
        total = await self.repo.get_count(filters=filters)

        return requests, total

    async def update_request(
        self,
        request_id: str,
        update_data: RequestUpdate,
        user_id: int
    ) -> BillingRequest:
        """Update a request's non-status fields."""
        request = await self.get_request(request_id)

        # Check for PHI in notes if being updated
        if update_data.notes:
            self._check_phi(update_data.notes)

        update_dict = update_data.model_dump(exclude_unset=True)

        # Add audit log entry
        await self._add_audit_entry(
            request.id,
            "updated",
            "Request updated",
            user_id
        )

        return await self.repo.update(request.id, update_dict)

    async def claim_request(self, request_id: str, admin_id: int) -> BillingRequest:
        """Claim a request (admin action)."""
        request = await self.get_request(request_id)

        if request.status != RequestStatus.OPEN.value:
            raise ValidationError(f"Cannot claim request in status {request.status}")

        await self._add_audit_entry(
            request.id,
            "claimed",
            "Request claimed by admin",
            admin_id
        )

        return await self.repo.update_status(
            request.id,
            RequestStatus.CLAIMED,
            admin_id=admin_id
        )

    async def send_to_client(
        self,
        request_id: str,
        admin_id: int,
        recipient_email: Optional[str] = None
    ) -> BillingRequest:
        """Mark request as sent to client."""
        request = await self.get_request(request_id)

        if request.status != RequestStatus.CLAIMED.value:
            raise ValidationError(f"Cannot send request in status {request.status}")

        await self._add_audit_entry(
            request.id,
            "sent_to_client",
            f"Sent to client{f' ({recipient_email})' if recipient_email else ''}",
            admin_id
        )

        return await self.repo.update_status(request.id, RequestStatus.SENT)

    async def record_client_response(
        self,
        request_id: str,
        response_data: dict
    ) -> BillingRequest:
        """Record a client's response from portal."""
        request = await self.get_request(request_id)

        if request.status != RequestStatus.SENT.value:
            raise ValidationError(f"Cannot record response for request in status {request.status}")

        # Update with response data
        update_dict = {
            "client_response_payload": response_data,
            "status": RequestStatus.RESPONDED,
            "responded_at": datetime.utcnow(),
        }

        await self._add_audit_entry(
            request.id,
            "client_response",
            "Client responded via portal",
            None
        )

        return await self.repo.update(request.id, update_dict)

    async def close_request(
        self,
        request_id: str,
        close_data: RequestCloseRequest,
        admin_id: int
    ) -> BillingRequest:
        """Close a request with resolution."""
        request = await self.get_request(request_id)

        if request.status == RequestStatus.CLOSED.value:
            raise ValidationError("Request is already closed")

        # Extract resolution code value (comes from Pydantic schema as enum)
        resolution_code_value = close_data.resolution_code.value if hasattr(close_data.resolution_code, 'value') else close_data.resolution_code

        await self._add_audit_entry(
            request.id,
            "closed",
            f"Closed with resolution: {resolution_code_value}",
            admin_id
        )

        update_dict = {
            "status": RequestStatus.CLOSED,
            "closed_at": datetime.utcnow(),
            "resolution_code": close_data.resolution_code,
            "resolution_notes": close_data.resolution_notes,
        }

        return await self.repo.update(request.id, update_dict)

    async def check_duplicate(
        self,
        account_reference: str,
        request_type: str
    ) -> dict:
        """Check if a duplicate request exists."""
        dedupe_key = self._generate_dedupe_key(account_reference, request_type)
        existing = await self.repo.get_by_dedupe_key(dedupe_key)

        if existing:
            return {
                "is_duplicate": True,
                "existing_request_id": existing.request_id,
                "existing_status": existing.status,
            }
        return {"is_duplicate": False}

    async def check_sla_breaches(self) -> List[BillingRequest]:
        """Check for and mark SLA breaches."""
        requests = await self.repo.get_requests_needing_sla_check()

        for request in requests:
            await self.repo.update(request.id, {"sla_breached": True})
            await self._add_audit_entry(
                request.id,
                "sla_breach",
                "SLA breach detected",
                None
            )

        return requests

    async def request_more_info(
        self,
        request_id: str,
        reason: str,
        message: Optional[str],
        admin_id: int
    ) -> BillingRequest:
        """
        Request more info from collector.
        Status stays CLAIMED, logs audit event for rework tracking.
        """
        request = await self.get_request(request_id)

        if request.status != RequestStatus.CLAIMED.value:
            raise ValidationError("Can only request info on CLAIMED requests")

        # Build description with reason and optional message
        description = f"More info requested: {reason}"
        if message:
            description += f" - Message: {message}"

        # Add audit entry for rework tracking
        await self._add_audit_entry(
            request.id,
            "need_info_requested",
            description,
            admin_id
        )

        return request

    # ==================== Private Methods ====================

    def _generate_dedupe_key(self, account_reference: str, request_type: str) -> str:
        """Generate a dedupe key from account and type."""
        raw = f"{account_reference}:{request_type}".lower()
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def _validate_required_fields(self, request_data: RequestCreate) -> None:
        """Validate that required fields for the request type are present."""
        type_config = get_request_type_config(RequestType(request_data.request_type))
        required_fields = type_config.get("required_fields", [])

        payload = request_data.required_fields_payload or {}
        missing = [f for f in required_fields if f not in payload or payload[f] is None or payload[f] == '']

        if missing:
            raise ValidationError(
                f"Missing required fields for {request_data.request_type}: {', '.join(missing)}"
            )

    def _check_phi(self, text: str) -> None:
        """Check for PHI patterns in text."""
        import re

        patterns = [
            (r'\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b', 'SSN'),
            (r'\b\d{9}\b', 'SSN (no dashes)'),
            (r'\b(dob|date of birth|birthday|born on|social security|ssn)\b', 'PHI keyword'),
        ]

        violations = []
        for pattern, violation_type in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                violations.append(violation_type)

        if violations:
            raise PHIDetectedError(violations)

    async def _add_audit_entry(
        self,
        request_id: int,
        event_type: str,
        description: str,
        user_id: Optional[int]
    ) -> None:
        """Add an entry to the request's audit log."""
        event = {
            "id": str(uuid.uuid4()),
            "type": event_type,
            "description": description,
            "timestamp": datetime.utcnow().isoformat(),
            "user": str(user_id) if user_id else None,
        }
        await self.repo.append_audit_log(request_id, event)
