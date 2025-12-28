"""
Billing Request API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, Any

from app.api.deps import get_db, get_current_active_user, get_admin_user
from app.models.user import User


from app.services.request_service import RequestService


from app.schemas.request import (
    RequestCreate,
    RequestUpdate,
    RequestResponse,
    RequestListResponse,
    RequestClaimRequest,
    RequestSendRequest,
    RequestCloseRequest,
    NeedInfoRequest,
    DedupeCheckRequest,
    DedupeCheckResponse,
    TimelineEvent,
    AttachmentResponse,
)
from app.core.exceptions import (
    NotFoundError, DuplicateRequestError, PHIDetectedError, ValidationError
)


def _get_attr(obj: Any, key: str, default: Any = None) -> Any:
    """Get attribute from object or dict (handles both Supabase dict and ORM model)."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


router = APIRouter()


@router.post("/", response_model=RequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    request_data: RequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Create a new billing request.
    Validates required fields, checks for duplicates, and enforces PHI rules.
    """
    service = RequestService(db)

    try:
        user_id = _get_attr(current_user, 'id')
        request = await service.create_request(request_data, user_id)
        return _build_request_response(request)
    except DuplicateRequestError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": e.detail,
                "existing_request_id": e.existing_request_id
            }
        )
    except PHIDetectedError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": e.detail,
                "violations": e.violations
            }
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.detail
        )


@router.get("/", response_model=RequestListResponse)
async def list_requests(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status: Optional[str] = Query(None),
    client_id: Optional[int] = Query(None),
    sla_breached: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List billing requests with filtering and pagination.
    Collectors see only their own requests.
    Admins and Supervisors see all requests.
    """
    service = RequestService(db)

    # Collectors can only see their own requests
    collector_id = None
    user_role = _get_attr(current_user, 'role')
    user_role_value = user_role.value if hasattr(user_role, 'value') else user_role
    if user_role_value == "collector":
        collector_id = _get_attr(current_user, 'id')

    skip = (page - 1) * page_size
    requests, total = await service.list_requests(
        skip=skip,
        limit=page_size,
        status=status,
        collector_id=collector_id,
        client_id=client_id,
        sla_breached=sla_breached,
    )

    return RequestListResponse(
        items=[_build_request_response(r) for r in requests],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size
    )


@router.get("/{request_id}", response_model=RequestResponse)
async def get_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific billing request by ID.
    """
    service = RequestService(db)

    try:
        request = await service.get_request(request_id)

        # Collectors can only see their own requests
        user_role = _get_attr(current_user, 'role')
        user_role_value = user_role.value if hasattr(user_role, 'value') else user_role
        request_collector_id = _get_attr(request, 'collector_id')
        if user_role_value == "collector" and request_collector_id != _get_attr(current_user, 'id'):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        return _build_request_response(request)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.detail
        )


@router.patch("/{request_id}", response_model=RequestResponse)
async def update_request(
    request_id: str,
    update_data: RequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a billing request.
    """
    service = RequestService(db)

    try:
        user_id = _get_attr(current_user, 'id')
        request = await service.update_request(request_id, update_data, user_id)
        return _build_request_response(request)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.detail
        )
    except PHIDetectedError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": e.detail,
                "violations": e.violations
            }
        )


@router.post("/{request_id}/claim", response_model=RequestResponse)
async def claim_request(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Claim a request (admin action).
    Moves request from OPEN to CLAIMED status.
    """
    service = RequestService(db)

    try:
        user_id = _get_attr(current_user, 'id')
        request = await service.claim_request(request_id, user_id)
        return _build_request_response(request)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.detail
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.detail
        )


@router.post("/{request_id}/send", response_model=RequestResponse)
async def send_to_client(
    request_id: str,
    send_data: RequestSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Send request to client.
    Moves request from CLAIMED to SENT status.
    """
    service = RequestService(db)

    try:
        user_id = _get_attr(current_user, 'id')
        request = await service.send_to_client(
            request_id,
            user_id,
            send_data.recipient_email
        )
        return _build_request_response(request)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.detail
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.detail
        )


@router.post("/{request_id}/close", response_model=RequestResponse)
async def close_request(
    request_id: str,
    close_data: RequestCloseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Close a request with resolution.
    """
    service = RequestService(db)

    try:
        user_id = _get_attr(current_user, 'id')
        request = await service.close_request(request_id, close_data, user_id)
        return _build_request_response(request)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.detail
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.detail
        )


@router.post("/{request_id}/need-info", response_model=RequestResponse)
async def request_more_info(
    request_id: str,
    need_info_data: NeedInfoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Request more info from collector.
    Status stays CLAIMED, logs event for rework tracking.
    """
    service = RequestService(db)

    try:
        user_id = _get_attr(current_user, 'id')
        request = await service.request_more_info(
            request_id,
            need_info_data.reason,
            need_info_data.message,
            user_id
        )
        return _build_request_response(request)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.detail
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.detail
        )


@router.post("/check-duplicate", response_model=DedupeCheckResponse)
async def check_duplicate(
    dedupe_data: DedupeCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Check if a duplicate request exists.
    Call this before creating a request to warn the user.
    """
    service = RequestService(db)
    result = await service.check_duplicate(
        dedupe_data.account_reference,
        dedupe_data.request_type
    )
    return DedupeCheckResponse(**result)


@router.get("/{request_id}/timeline")
async def get_request_timeline(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get the timeline/audit log for a request.
    """
    service = RequestService(db)

    try:
        request = await service.get_request(request_id)
        return {"timeline": request.audit_log or []}
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=e.detail
        )


# ==================== Helper Functions ====================

def _build_request_response(request) -> RequestResponse:
    """Build a RequestResponse from a BillingRequest model."""
    return RequestResponse(
        id=request.id,
        request_id=request.request_id,
        agency_id=request.agency_id,
        client_id=request.client_id,
        client_name=request.client.name if request.client else None,
        account_reference=request.account_reference,
        internal_file_id=request.internal_file_id,
        debtor_language=request.debtor_language,
        collector_id=request.collector_id,
        collector_name=request.collector.full_name if request.collector else None,
        assigned_admin_id=request.assigned_admin_id,
        assigned_admin_name=request.assigned_admin.full_name if request.assigned_admin else None,
        request_type=request.request_type,
        required_fields_payload=request.required_fields_payload or {},
        notes=request.notes,
        status=request.status,
        priority=request.priority,
        hold_behavior=request.hold_behavior if request.hold_behavior else "soft_hold",
        created_at=request.created_at,
        updated_at=request.updated_at,
        claimed_at=request.claimed_at,
        sent_at=request.sent_at,
        responded_at=request.responded_at,
        closed_at=request.closed_at,
        sla_due_at=request.sla_due_at,
        sla_breached=request.sla_breached,
        resolution_code=request.resolution_code,
        resolution_notes=request.resolution_notes,
        attachments=[
            AttachmentResponse.model_validate(a) for a in (request.attachments or [])
        ],
        timeline=[
            TimelineEvent(**e) for e in (request.audit_log or [])
        ]
    )
