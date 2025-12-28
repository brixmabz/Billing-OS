"""
Dashboard API endpoints for analytics and metrics.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import Optional

from app.api.deps import get_db, get_current_active_user, get_supervisor_user, get_admin_user
from app.models.user import User, UserRole
from app.models.request import BillingRequest, RequestStatus
from app.models.client import Client

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get overview statistics for the dashboard.
    """
    # Total requests by status
    status_counts = db.query(
        BillingRequest.status,
        func.count(BillingRequest.id)
    ).group_by(BillingRequest.status).all()

    status_dict = {s.value: 0 for s in RequestStatus}
    for status, count in status_counts:
        # status is now a string from the DB
        status_dict[status] = count

    # SLA breach count
    breach_count = db.query(func.count(BillingRequest.id)).filter(
        BillingRequest.sla_breached == True,
        BillingRequest.status != RequestStatus.CLOSED.value
    ).scalar()

    # Average resolution time (for closed requests in last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    closed_requests = db.query(BillingRequest).filter(
        BillingRequest.status == RequestStatus.CLOSED.value,
        BillingRequest.closed_at >= thirty_days_ago
    ).all()

    avg_resolution_hours = 0
    if closed_requests:
        total_hours = sum(
            (r.closed_at - r.created_at).total_seconds() / 3600
            for r in closed_requests if r.closed_at and r.created_at
        )
        avg_resolution_hours = total_hours / len(closed_requests)

    total_requests = sum(status_dict.values())

    return {
        "total_requests": total_requests,
        "pending_requests": status_dict.get("OPEN", 0),
        "claimed_requests": status_dict.get("CLAIMED", 0),
        "with_client_requests": status_dict.get("SENT", 0),
        "responded_requests": status_dict.get("RESPONDED", 0),
        "closed_requests": status_dict.get("CLOSED", 0),
        "sla_breach_count": breach_count,
        "average_resolution_hours": round(avg_resolution_hours, 1),
    }


@router.get("/collector-performance")
async def get_collector_performance(
    days: int = Query(30, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_supervisor_user)
):
    """
    Get collector performance metrics (supervisor only).
    """
    since = datetime.utcnow() - timedelta(days=days)

    # Get all collectors
    collectors = db.query(User).filter(
        User.role == UserRole.COLLECTOR.value,
        User.is_active == True
    ).all()

    performance = []
    for collector in collectors:
        # Total requests created
        total = db.query(func.count(BillingRequest.id)).filter(
            BillingRequest.collector_id == collector.id,
            BillingRequest.created_at >= since
        ).scalar()

        # Closed requests
        closed = db.query(func.count(BillingRequest.id)).filter(
            BillingRequest.collector_id == collector.id,
            BillingRequest.status == RequestStatus.CLOSED.value,
            BillingRequest.created_at >= since
        ).scalar()

        # SLA compliance (non-breached / total)
        breached = db.query(func.count(BillingRequest.id)).filter(
            BillingRequest.collector_id == collector.id,
            BillingRequest.sla_breached == True,
            BillingRequest.created_at >= since
        ).scalar()

        sla_compliance = ((total - breached) / total * 100) if total > 0 else 100

        # Average resolution time
        closed_requests = db.query(BillingRequest).filter(
            BillingRequest.collector_id == collector.id,
            BillingRequest.status == RequestStatus.CLOSED.value,
            BillingRequest.created_at >= since
        ).all()

        avg_hours = 0
        if closed_requests:
            total_hours = sum(
                (r.closed_at - r.created_at).total_seconds() / 3600
                for r in closed_requests if r.closed_at and r.created_at
            )
            avg_hours = total_hours / len(closed_requests)

        performance.append({
            "collector_id": collector.id,
            "collector_name": collector.full_name,
            "total_requests": total,
            "closed_requests": closed,
            "avg_resolution_hours": round(avg_hours, 1),
            "sla_compliance": round(sla_compliance, 1),
        })

    # Sort by total requests descending
    performance.sort(key=lambda x: x["total_requests"], reverse=True)

    return performance


@router.get("/client-rankings")
async def get_client_rankings(
    days: int = Query(30, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_supervisor_user)
):
    """
    Get client response rankings (supervisor only).
    """
    since = datetime.utcnow() - timedelta(days=days)

    # Get all clients with requests
    clients = db.query(Client).filter(Client.is_active == True).all()

    rankings = []
    for client in clients:
        # Total requests sent to client
        total_sent = db.query(func.count(BillingRequest.id)).filter(
            BillingRequest.client_id == client.id,
            BillingRequest.sent_at.isnot(None),
            BillingRequest.sent_at >= since
        ).scalar()

        if total_sent == 0:
            continue

        # Responded requests
        responded = db.query(func.count(BillingRequest.id)).filter(
            BillingRequest.client_id == client.id,
            BillingRequest.responded_at.isnot(None),
            BillingRequest.sent_at >= since
        ).scalar()

        response_rate = (responded / total_sent * 100) if total_sent > 0 else 0

        # Average response time
        responded_requests = db.query(BillingRequest).filter(
            BillingRequest.client_id == client.id,
            BillingRequest.responded_at.isnot(None),
            BillingRequest.sent_at >= since
        ).all()

        avg_hours = 0
        if responded_requests:
            total_hours = sum(
                (r.responded_at - r.sent_at).total_seconds() / 3600
                for r in responded_requests if r.responded_at and r.sent_at
            )
            avg_hours = total_hours / len(responded_requests)

        rankings.append({
            "client_id": client.id,
            "client_name": client.name,
            "total_requests": total_sent,
            "response_rate": round(response_rate, 1),
            "avg_response_hours": round(avg_hours, 1),
        })

    # Sort by response rate descending
    rankings.sort(key=lambda x: x["response_rate"], reverse=True)

    return rankings


@router.get("/sla-breaches")
async def get_sla_breaches(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Get current SLA breach summary.
    """
    # Get all breached requests that are still open
    breached = db.query(BillingRequest).filter(
        BillingRequest.sla_breached == True,
        BillingRequest.status.in_([
            RequestStatus.OPEN.value,
            RequestStatus.CLAIMED.value,
            RequestStatus.SENT.value
        ])
    ).order_by(BillingRequest.sla_due_at).all()

    return [{
        "request_id": r.request_id,
        "client_name": r.client.name if r.client else None,
        "request_type": r.request_type,
        "status": r.status,
        "sla_due_at": r.sla_due_at.isoformat() if r.sla_due_at else None,
        "hours_overdue": round(
            (datetime.utcnow() - r.sla_due_at).total_seconds() / 3600, 1
        ) if r.sla_due_at else 0,
        "assigned_to": r.assigned_admin.full_name if r.assigned_admin else "Unassigned",
    } for r in breached]
