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


@router.get("/metrics")
async def get_dashboard_metrics(
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
        "open_requests": status_dict.get("OPEN", 0),
        "claimed_requests": status_dict.get("CLAIMED", 0),
        "sent_requests": status_dict.get("SENT", 0),
        "responded_requests": status_dict.get("RESPONDED", 0),
        "closed_requests": status_dict.get("CLOSED", 0),
        "sla_breach_rate": round((breach_count / total_requests * 100), 1) if total_requests > 0 else 0,
        "avg_time_to_claim_minutes": 0,
        "avg_time_to_send_hours": 0,
        "avg_client_response_days": 0,
        "requests_today": 0,
        "requests_this_week": 0,
    }


@router.get("/collector-stats")
async def get_collector_stats(
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
            "open_requests": 0,
            "closed_requests": closed,
            "avg_resolution_days": round(avg_hours / 24, 1) if avg_hours > 0 else 0,
            "sla_compliance_rate": round(sla_compliance, 1),
            "requests_per_day": round(total / days, 2) if days > 0 else 0,
            "stall_ratio": 0,
            "false_alarm_rate": 0,
            "status": "online",
        })

    # Sort by total requests descending
    performance.sort(key=lambda x: x["total_requests"], reverse=True)

    return performance


@router.get("/client-stats")
async def get_client_stats(
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
            "pending_requests": 0,
            "avg_response_days": round(avg_hours / 24, 1) if avg_hours > 0 else 0,
            "response_rate": round(response_rate, 1),
            "overdue_count": 0,
            "sla_score": 100,
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


@router.get("/activity")
async def get_activity(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get recent activity feed."""
    recent = db.query(BillingRequest).order_by(
        BillingRequest.updated_at.desc()
    ).limit(limit).all()

    events = []
    for r in recent:
        events.append({
            "id": str(r.id),
            "type": f"request_{r.status.lower()}",
            "description": f"Request {r.request_id} - {r.status}",
            "request_id": r.request_id,
            "client_name": r.client.name if r.client else None,
            "timestamp": r.updated_at.isoformat() if r.updated_at else r.created_at.isoformat(),
        })
    return events


@router.get("/request-volume")
async def get_request_volume(
    days: int = Query(30, ge=1, le=90),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get request volume by day for charts."""
    since = datetime.utcnow() - timedelta(days=days)

    results = db.query(
        func.date(BillingRequest.created_at).label('date'),
        func.count(BillingRequest.id).label('created')
    ).filter(
        BillingRequest.created_at >= since
    ).group_by(func.date(BillingRequest.created_at)).order_by(
        func.date(BillingRequest.created_at)
    ).all()

    return [{"date": str(r.date), "created": r.created, "closed": 0, "breached": 0} for r in results]


@router.get("/request-types")
async def get_request_types(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get request type distribution."""
    results = db.query(
        BillingRequest.request_type,
        func.count(BillingRequest.id).label('count')
    ).group_by(BillingRequest.request_type).all()

    total = sum(r.count for r in results)
    return [{
        "request_type": r.request_type,
        "count": r.count,
        "percentage": round(r.count / total * 100, 1) if total > 0 else 0
    } for r in results]


@router.get("/under-effort-alerts")
async def get_under_effort_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """Get under-effort collector alerts (placeholder)."""
    return []
