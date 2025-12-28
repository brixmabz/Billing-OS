"""
Audit Service - Tracks all changes to billing requests.

Every state change, assignment, and action is logged to provide
a complete audit trail for compliance and debugging.
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from enum import Enum
from sqlalchemy.orm import Session

from app.db.postgres.repositories import PostgresRequestRepository


class AuditEventType(str, Enum):
    """Types of audit events."""
    # Lifecycle events
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"

    # Status changes
    STATUS_CHANGE = "status_change"
    CLAIMED = "claimed"
    SENT_TO_CLIENT = "sent_to_client"
    CLIENT_RESPONSE = "client_response"
    CLOSED = "closed"
    REOPENED = "reopened"

    # Assignment events
    ASSIGNED = "assigned"
    UNASSIGNED = "unassigned"
    REASSIGNED = "reassigned"

    # SLA events
    SLA_WARNING = "sla_warning"
    SLA_BREACH = "sla_breach"
    SLA_ESCALATED = "sla_escalated"

    # Communication events
    EMAIL_SENT = "email_sent"
    SLACK_POSTED = "slack_posted"
    SLACK_UPDATED = "slack_updated"

    # Document events
    ATTACHMENT_ADDED = "attachment_added"
    ATTACHMENT_REMOVED = "attachment_removed"

    # Portal events
    PORTAL_ACCESSED = "portal_accessed"
    PORTAL_RESPONSE = "portal_response"
    PORTAL_UPLOAD = "portal_upload"

    # Notes/Comments
    NOTE_ADDED = "note_added"
    COMMENT_ADDED = "comment_added"


@dataclass
class AuditEvent:
    """Represents a single audit event."""
    id: str
    type: str
    description: str
    timestamp: str
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON storage."""
        return asdict(self)


class AuditService:
    """
    Service for creating and managing audit logs.
    """

    def __init__(self, db: Session):
        self.db = db
        self.repo = PostgresRequestRepository(db)

    def create_event(
        self,
        event_type: AuditEventType,
        description: str,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """
        Create a new audit event.

        Args:
            event_type: Type of event
            description: Human-readable description
            user_id: ID of user who triggered event (None for system events)
            user_name: Name of user (for display without lookup)
            metadata: Additional event-specific data

        Returns:
            AuditEvent object
        """
        return AuditEvent(
            id=str(uuid.uuid4()),
            type=event_type.value,
            description=description,
            timestamp=datetime.utcnow().isoformat(),
            user_id=str(user_id) if user_id else None,
            user_name=user_name,
            metadata=metadata
        )

    async def log_event(
        self,
        request_id: int,
        event_type: AuditEventType,
        description: str,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[AuditEvent]:
        """
        Log an event to a request's audit trail.

        Args:
            request_id: Database ID of the request
            event_type: Type of event
            description: Human-readable description
            user_id: ID of user who triggered event
            user_name: Name of user
            metadata: Additional event-specific data

        Returns:
            The created AuditEvent, or None if request not found
        """
        event = self.create_event(
            event_type=event_type,
            description=description,
            user_id=user_id,
            user_name=user_name,
            metadata=metadata
        )

        result = await self.repo.append_audit_log(request_id, event.to_dict())

        if result:
            return event
        return None

    async def log_status_change(
        self,
        request_id: int,
        old_status: str,
        new_status: str,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None
    ) -> Optional[AuditEvent]:
        """
        Log a status change event.

        Args:
            request_id: Database ID of the request
            old_status: Previous status
            new_status: New status
            user_id: ID of user who made the change
            user_name: Name of user

        Returns:
            The created AuditEvent
        """
        return await self.log_event(
            request_id=request_id,
            event_type=AuditEventType.STATUS_CHANGE,
            description=f"Status changed from {old_status} to {new_status}",
            user_id=user_id,
            user_name=user_name,
            metadata={
                "old_status": old_status,
                "new_status": new_status
            }
        )

    async def log_assignment(
        self,
        request_id: int,
        assigned_to_id: int,
        assigned_to_name: str,
        assigned_by_id: Optional[int] = None,
        assigned_by_name: Optional[str] = None
    ) -> Optional[AuditEvent]:
        """
        Log an assignment event.
        """
        return await self.log_event(
            request_id=request_id,
            event_type=AuditEventType.ASSIGNED,
            description=f"Assigned to {assigned_to_name}",
            user_id=assigned_by_id,
            user_name=assigned_by_name,
            metadata={
                "assigned_to_id": assigned_to_id,
                "assigned_to_name": assigned_to_name
            }
        )

    async def log_email_sent(
        self,
        request_id: int,
        recipient: str,
        subject: str,
        user_id: Optional[int] = None,
        user_name: Optional[str] = None
    ) -> Optional[AuditEvent]:
        """
        Log an email sent event.
        """
        return await self.log_event(
            request_id=request_id,
            event_type=AuditEventType.EMAIL_SENT,
            description=f"Email sent to {recipient}",
            user_id=user_id,
            user_name=user_name,
            metadata={
                "recipient": recipient,
                "subject": subject
            }
        )

    async def log_sla_breach(
        self,
        request_id: int,
        breach_type: str,
        details: str
    ) -> Optional[AuditEvent]:
        """
        Log an SLA breach event (system-triggered).
        """
        return await self.log_event(
            request_id=request_id,
            event_type=AuditEventType.SLA_BREACH,
            description=f"SLA breach: {breach_type}",
            metadata={
                "breach_type": breach_type,
                "details": details
            }
        )

    async def log_portal_access(
        self,
        request_id: int,
        ip_address: Optional[str] = None
    ) -> Optional[AuditEvent]:
        """
        Log when client accesses the portal.
        """
        return await self.log_event(
            request_id=request_id,
            event_type=AuditEventType.PORTAL_ACCESSED,
            description="Client accessed portal",
            metadata={
                "ip_address": ip_address
            }
        )

    async def log_portal_response(
        self,
        request_id: int,
        resolution_type: str
    ) -> Optional[AuditEvent]:
        """
        Log when client submits response via portal.
        """
        return await self.log_event(
            request_id=request_id,
            event_type=AuditEventType.PORTAL_RESPONSE,
            description=f"Client responded via portal: {resolution_type}",
            metadata={
                "resolution_type": resolution_type
            }
        )

    async def get_timeline(self, request_id: int) -> List[Dict[str, Any]]:
        """
        Get the full audit timeline for a request.

        Args:
            request_id: Database ID of the request

        Returns:
            List of audit events in chronological order
        """
        request = await self.repo.get(request_id)
        if not request:
            return []

        audit_log = request.audit_log or []

        # Sort by timestamp (oldest first)
        return sorted(audit_log, key=lambda x: x.get("timestamp", ""))

    async def get_recent_activity(
        self,
        request_id: int,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get recent activity for a request.

        Args:
            request_id: Database ID of the request
            limit: Maximum number of events to return

        Returns:
            List of most recent audit events
        """
        timeline = await self.get_timeline(request_id)

        # Return most recent events (reverse chronological)
        return list(reversed(timeline[-limit:]))
