"""
Client management API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.api.deps import get_db, get_current_active_user, get_admin_user
from app.models.user import User
from app.db.postgres.repositories import PostgresClientRepository
from app.schemas.client import ClientResponse, ClientCreate, ClientUpdate, ClientListResponse

router = APIRouter()


@router.get("/", response_model=ClientListResponse)
async def list_clients(
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all clients.
    """
    repo = PostgresClientRepository(db)

    filters = {}
    if is_active is not None:
        filters["is_active"] = is_active

    clients = await repo.get_multi(filters=filters)

    return ClientListResponse(
        items=[ClientResponse.model_validate(c) for c in clients],
        total=len(clients)
    )


@router.get("/active")
async def list_active_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all active clients (for dropdowns).
    """
    repo = PostgresClientRepository(db)
    clients = await repo.get_active_clients()

    return [{"id": c.id, "code": c.code, "name": c.name} for c in clients]


@router.get("/{client_id}", response_model=ClientResponse)
async def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific client by ID.
    """
    repo = PostgresClientRepository(db)
    client = await repo.get(client_id)

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    return ClientResponse.model_validate(client)


@router.get("/code/{code}", response_model=ClientResponse)
async def get_client_by_code(
    code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a client by their code.
    """
    repo = PostgresClientRepository(db)
    client = await repo.get_by_code(code.upper())

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    return ClientResponse.model_validate(client)


@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Create a new client (admin only).
    """
    repo = PostgresClientRepository(db)

    # Check if code exists
    existing = await repo.get_by_code(client_data.code.upper())
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Client code '{client_data.code}' already exists"
        )

    # Create client
    client_dict = client_data.model_dump()
    client_dict["code"] = client_dict["code"].upper()

    client = await repo.create(client_dict)
    return ClientResponse.model_validate(client)


@router.patch("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: int,
    update_data: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Update a client (admin only).
    """
    repo = PostgresClientRepository(db)

    client = await repo.get(client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    update_dict = update_data.model_dump(exclude_unset=True)
    updated_client = await repo.update(client_id, update_dict)

    return ClientResponse.model_validate(updated_client)


@router.put("/{client_id}", response_model=ClientResponse)
async def replace_client(
    client_id: int,
    update_data: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_admin_user)
):
    """
    Replace/update a client (admin only).
    """
    repo = PostgresClientRepository(db)

    client = await repo.get(client_id)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    update_dict = update_data.model_dump(exclude_unset=True)
    updated_client = await repo.update(client_id, update_dict)

    return ClientResponse.model_validate(updated_client)


@router.get("/{client_id}/contacts")
async def get_client_contacts(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get all contacts for a client.
    """
    repo = PostgresClientRepository(db)
    client = await repo.get(client_id)

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found"
        )

    contacts = [
        {"name": client.contact_name, "email": client.email, "role": "Primary"}
    ]

    if client.additional_contacts:
        contacts.extend(client.additional_contacts)

    return contacts
