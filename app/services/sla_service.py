"""
SLA Service - Tracks and enforces Service Level Agreements.

SLA rules from PRD:
- Request unclaimed > 15 min → Slack alert to lead
- Request not sent > 4 hrs → Escalation to supervisor
- No client response > 3 biz days → Auto follow-up email
- No client response > 7 biz days → Supervisor + client escalation
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum
from sqlalchemy.orm import Session

from app.db.postgres.repositories import PostgresRequestRepository
from app.models.request import BillingRequest, RequestStatus, REQUEST_TYPE_CONFIG, RequestType
from app.core.config import settings


class SLABreachType(str, Enum):
    """Types of SLA breaches."""
    UNCLAIMED = "unclaimed"           # Request not claimed within threshold
    NOT_SENT = "not_sent"             # Request claimed but not sent within threshold
    CLIENT_WARNING = "client_warning" # Client hasn't responded (warning threshold)
    CLIENT_BREACH = "client_breach"   # Client hasn't responded (breach threshold)
    OVERDUE = "overdue"               # Past SLA due date


@dataclass
class SLAStatus:
    """Status of SLA for a request."""
    request_id: str
    is_breached: bool
    breach_types: List[SLABreachType]
    minutes_until_breach: Optional[int]  # None if already breached
    sla_due_at: Optional[datetime]
    recommendations: List[str]


class SLAService:
    """
    Service for SLA tracking, breach detection, and escalation.
    """

    def __init__(self, db: Session):
        self.db = db
        self.repo = PostgresRequestRepository(db)

    def calculate_sla_due(
        self,
        request_type: str,
        created_at: datetime,
        client_sla_hours: Optional[int] = None
    ) -> datetime:
        """
        Calculate when a request's SLA is due.

        Args:
            request_type: The type of request
            created_at: When the request was created
            client_sla_hours: Override SLA from client config (optional)

        Returns:
            datetime when SLA is due
        """
        # Get type-specific SLA or use client override
        type_config = REQUEST_TYPE_CONFIG.get(RequestType(request_type), {})
        sla_hours = client_sla_hours or type_config.get("sla_hours", 72)

        return created_at + timedelta(hours=sla_hours)

    def check_request_sla(self, request: BillingRequest) -> SLAStatus:
        """
        Check SLA status for a single request.

        Args:
            request: The billing request to check

        Returns:
            SLAStatus with breach information
        """
        now = datetime.utcnow()
        breaches = []
        recommendations = []
        minutes_until_breach = None

        # Check based on current status
        if request.status == RequestStatus.OPEN.value:
            # Check unclaimed threshold (15 minutes)
            minutes_open = (now - request.created_at).total_seconds() / 60

            if minutes_open > settings.SLA_UNCLAIMED_THRESHOLD:
                breaches.append(SLABreachType.UNCLAIMED)
                recommendations.append("Claim this request immediately")
            else:
                minutes_until_breach = int(settings.SLA_UNCLAIMED_THRESHOLD - minutes_open)

        elif request.status == RequestStatus.CLAIMED.value:
            # Check not-sent threshold (4 hours = 240 minutes)
            if request.claimed_at:
                minutes_claimed = (now - request.claimed_at).total_seconds() / 60

                if minutes_claimed > settings.SLA_NOT_SENT_THRESHOLD:
                    breaches.append(SLABreachType.NOT_SENT)
                    recommendations.append("Send to client immediately")
                else:
                    minutes_until_breach = int(settings.SLA_NOT_SENT_THRESHOLD - minutes_claimed)

        elif request.status == RequestStatus.SENT.value:
            # Check client response thresholds
            if request.sent_at:
                minutes_waiting = (now - request.sent_at).total_seconds() / 60

                if minutes_waiting > settings.SLA_CLIENT_RESPONSE_BREACH:
                    breaches.append(SLABreachType.CLIENT_BREACH)
                    recommendations.append("Escalate to supervisor and client leadership")
                elif minutes_waiting > settings.SLA_CLIENT_RESPONSE_WARNING:
                    breaches.append(SLABreachType.CLIENT_WARNING)
                    recommendations.append("Send follow-up to client")
                else:
                    minutes_until_breach = int(settings.SLA_CLIENT_RESPONSE_WARNING - minutes_waiting)

        # Check overall SLA due date
        if request.sla_due_at and now > request.sla_due_at:
            if SLABreachType.OVERDUE not in breaches:
                breaches.append(SLABreachType.OVERDUE)
                recommendations.append("Request is past due - prioritize resolution")

        return SLAStatus(
            request_id=request.request_id,
            is_breached=len(breaches) > 0,
            breach_types=breaches,
            minutes_until_breach=minutes_until_breach,
            sla_due_at=request.sla_due_at,
            recommendations=recommendations
        )

    async def get_breached_requests(self) -> List[Dict[str, Any]]:
        """
        Get all currently breached requests.

        Returns:
            List of breach information dictionaries
        """
        # Get all non-closed requests
        open_requests = await self.repo.get_multi(
            filters={"statuses": [
                RequestStatus.OPEN.value,
                RequestStatus.CLAIMED.value,
                RequestStatus.SENT.value
            ]},
            limit=1000  # Get all
        )

        breached = []
        for request in open_requests:
            status = self.check_request_sla(request)
            if status.is_breached:
                breached.append({
                    "request_id": request.request_id,
                    "request_type": request.request_type,
                    "status": request.status,
                    "breach_types": [b.value for b in status.breach_types],
                    "sla_due_at": request.sla_due_at.isoformat() if request.sla_due_at else None,
                    "recommendations": status.recommendations,
                    "client_name": request.client.name if request.client else None,
                    "assigned_to": request.assigned_admin.full_name if request.assigned_admin else "Unassigned",
                })

        return breached

    async def get_requests_needing_action(self) -> Dict[str, List[BillingRequest]]:
        """
        Get requests categorized by needed action.

        Returns:
            Dictionary with keys: 'claim_now', 'send_now', 'follow_up', 'escalate'
        """
        open_requests = await self.repo.get_multi(
            filters={"statuses": [
                RequestStatus.OPEN.value,
                RequestStatus.CLAIMED.value,
                RequestStatus.SENT.value
            ]},
            limit=1000
        )

        result = {
            "claim_now": [],      # Unclaimed and approaching/past threshold
            "send_now": [],       # Claimed but approaching/past send threshold
            "follow_up": [],      # Sent and approaching warning threshold
            "escalate": [],       # Past breach threshold
        }

        for request in open_requests:
            status = self.check_request_sla(request)

            if SLABreachType.UNCLAIMED in status.breach_types:
                result["claim_now"].append(request)
            elif SLABreachType.NOT_SENT in status.breach_types:
                result["send_now"].append(request)
            elif SLABreachType.CLIENT_WARNING in status.breach_types:
                result["follow_up"].append(request)
            elif SLABreachType.CLIENT_BREACH in status.breach_types:
                result["escalate"].append(request)

        return result

    async def mark_breaches(self) -> int:
        """
        Mark all breached requests in the database.

        Returns:
            Number of requests marked as breached
        """
        requests = await self.repo.get_requests_needing_sla_check()

        count = 0
        for request in requests:
            await self.repo.update(request.id, {"sla_breached": True})
            count += 1

        return count

    def get_sla_summary(self, requests: List[BillingRequest]) -> Dict[str, Any]:
        """
        Get SLA summary statistics for a list of requests.

        Args:
            requests: List of requests to analyze

        Returns:
            Summary statistics
        """
        total = len(requests)
        breached = 0
        by_breach_type = {bt.value: 0 for bt in SLABreachType}

        for request in requests:
            status = self.check_request_sla(request)
            if status.is_breached:
                breached += 1
                for bt in status.breach_types:
                    by_breach_type[bt.value] += 1

        return {
            "total_requests": total,
            "breached_count": breached,
            "breach_rate": round(breached / total * 100, 1) if total > 0 else 0,
            "by_breach_type": by_breach_type,
        }
