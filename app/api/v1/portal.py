"""
Client Portal API endpoints.
Provides secure access for clients to respond to requests.
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime

from app.api.deps import get_db
from app.db.postgres.repositories import PostgresRequestRepository
from app.services.request_service import RequestService
from app.schemas.portal import (
    PortalValidateResponse,
    PortalRequestResponse,
    PortalRequestInfo,
    PortalRespondRequest,
    PortalRespondResponse,
    PortalUploadResponse,
)
from app.models.request import RequestStatus, REQUEST_TYPE_CONFIG, RequestType

router = APIRouter()


# Human-readable request type names
REQUEST_TYPE_DISPLAY = {
    "insurance_coverage_claim": "Insurance Coverage Claim",
    "wrong_insurance_refile": "Wrong Insurance / Refile",
    "auto_accident_3rd_party": "Auto Accident / 3rd Party",
    "medicaid_medicare_question": "Medicaid/Medicare Question",
    "paid_direct_to_provider": "Paid Direct to Provider",
    "on_payment_plan": "On Payment Plan",
    "payment_posted_wrong": "Payment Posted Wrong",
    "not_our_patient": "Not Our Patient / No Service",
    "identity_theft_fraud": "Identity Theft / Fraud",
    "itemized_bill_request": "Itemized Bill Request",
    "validation_package_request": "Validation Package Request",
    "statement_resend": "Statement Resend",
    "overcharged_balance_incorrect": "Overcharged / Balance Incorrect",
    "service_cancelled_not_billed": "Service Cancelled / Not Billed",
}


@router.get("/validate/{token}", response_model=PortalValidateResponse)
async def validate_portal_token(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Validate a portal access token.
    Returns whether the token is valid and not expired.
    """
    repo = PostgresRequestRepository(db)
    request = await repo.get_by_portal_token(token)

    if not request:
        return PortalValidateResponse(
            is_valid=False,
            error="Invalid or expired token"
        )

    # Check expiration
    if request.portal_token_expires_at and request.portal_token_expires_at < datetime.utcnow():
        return PortalValidateResponse(
            is_valid=False,
            error="Token has expired"
        )

    # Check if request is in correct status
    if request.status not in [RequestStatus.SENT.value, RequestStatus.RESPONDED.value]:
        return PortalValidateResponse(
            is_valid=False,
            error="Request is not awaiting response"
        )

    return PortalValidateResponse(
        is_valid=True,
        request_id=request.request_id,
        expires_at=request.portal_token_expires_at
    )


@router.get("/{token}/request", response_model=PortalRequestResponse)
async def get_portal_request(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Get request information for the portal.
    Returns limited, PHI-safe information for the client to respond.
    """
    repo = PostgresRequestRepository(db)
    request = await repo.get_by_portal_token(token)

    if not request:
        return PortalRequestResponse(
            is_valid=False,
            error="Invalid or expired token"
        )

    # Check expiration
    if request.portal_token_expires_at and request.portal_token_expires_at < datetime.utcnow():
        return PortalRequestResponse(
            is_valid=False,
            error="Token has expired"
        )

    # Build PHI-safe request info
    request_type_value = request.request_type if request.request_type else "unknown"
    request_info = PortalRequestInfo(
        request_id=request.request_id,
        request_type=request_type_value,
        request_type_display=REQUEST_TYPE_DISPLAY.get(request_type_value, request_type_value),
        account_reference=request.account_reference,
        created_at=request.created_at,
        status=request.status,
    )

    return PortalRequestResponse(
        is_valid=True,
        request=request_info,
        client_name=request.client.name if request.client else None
    )


@router.post("/{token}/respond", response_model=PortalRespondResponse)
async def submit_portal_response(
    token: str,
    response_data: PortalRespondRequest,
    db: Session = Depends(get_db)
):
    """
    Submit a response via the portal.
    Client provides resolution type, notes, and any additional info.
    """
    repo = PostgresRequestRepository(db)
    request = await repo.get_by_portal_token(token)

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired token"
        )

    # Check expiration
    if request.portal_token_expires_at and request.portal_token_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token has expired"
        )

    # Check status
    if request.status != RequestStatus.SENT.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request has already been responded to or is not awaiting response"
        )

    # Record the response
    service = RequestService(db)
    await service.record_client_response(
        request.request_id,
        response_data.model_dump()
    )

    return PortalRespondResponse(
        success=True,
        message="Response submitted successfully. The agency will review and follow up.",
        request_id=request.request_id
    )


@router.post("/{token}/upload", response_model=PortalUploadResponse)
async def upload_portal_file(
    token: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a file via the portal.
    Accepts documents like EOBs, ledgers, proof of payment, etc.
    """
    repo = PostgresRequestRepository(db)
    request = await repo.get_by_portal_token(token)

    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or expired token"
        )

    # Check expiration
    if request.portal_token_expires_at and request.portal_token_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token has expired"
        )

    # Validate file type
    allowed_types = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/gif",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: PDF, JPEG, PNG, GIF, DOC, DOCX"
        )

    # Check file size (max 10MB)
    max_size = 10 * 1024 * 1024
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 10MB."
        )

    # TODO: Save file to storage (local, S3, or Supabase storage)
    # For now, return a placeholder response

    return PortalUploadResponse(
        success=True,
        filename=file.filename,
        file_id=0,  # TODO: Return actual attachment ID
        message="File uploaded successfully"
    )
