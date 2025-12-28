"""
User management API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, Any

from app.api.deps import get_db, get_current_active_user, get_supervisor_user
from app.models.user import User, UserRole
from app.db.factory import get_user_repository
from app.schemas.user import UserResponse, UserCreate, UserUpdate, UserListResponse
from app.core.security import get_password_hash


def _get_attr(obj: Any, key: str, default: Any = None) -> Any:
    """Get attribute from object or dict (handles both Supabase dict and ORM model)."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


router = APIRouter()


@router.get("/", response_model=UserListResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_supervisor_user)
):
    """
    List all users (supervisor only).
    """
    repo = get_user_repository()

    filters = {}
    if role:
        filters["role"] = role
    if is_active is not None:
        filters["is_active"] = is_active

    skip = (page - 1) * page_size
    users = await repo.get_multi(skip=skip, limit=page_size, filters=filters)

    return UserListResponse(
        items=[UserResponse.model_validate(u) for u in users],
        total=len(users),  # TODO: Add proper count
        page=page,
        page_size=page_size,
        pages=1
    )


@router.get("/collectors")
async def list_collectors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all active collectors.
    """
    repo = get_user_repository()
    collectors = await repo.get_by_role(UserRole.COLLECTOR)

    return [UserResponse.model_validate(c) for c in collectors]


@router.get("/admins")
async def list_admins(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all active admins.
    """
    repo = get_user_repository()
    admins = await repo.get_by_role(UserRole.ADMIN)

    return [UserResponse.model_validate(a) for a in admins]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a specific user by ID.
    Users can view their own profile. Supervisors can view any user.
    """
    user_role = _get_attr(current_user, 'role')
    user_role_value = user_role.value if hasattr(user_role, 'value') else user_role
    if _get_attr(current_user, 'id') != user_id and user_role_value != UserRole.SUPERVISOR.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    repo = get_user_repository()
    user = await repo.get(user_id)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse.model_validate(user)


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_supervisor_user)
):
    """
    Create a new user (supervisor only).
    """
    repo = get_user_repository()

    # Check if username exists
    existing = await repo.get_by_username(user_data.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{user_data.username}' already exists"
        )

    # Check if email exists
    existing = await repo.get_by_email(user_data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{user_data.email}' already exists"
        )

    # Create user
    user_dict = user_data.model_dump(exclude={"password"})
    user_dict["hashed_password"] = get_password_hash(user_data.password)

    user = await repo.create(user_dict)
    return UserResponse.model_validate(user)


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    update_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update a user.
    Users can update their own profile (limited fields).
    Supervisors can update any user.
    """
    repo = get_user_repository()

    # Check permissions
    user_role = _get_attr(current_user, 'role')
    user_role_value = user_role.value if hasattr(user_role, 'value') else user_role
    if _get_attr(current_user, 'id') != user_id and user_role_value != UserRole.SUPERVISOR.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Non-supervisors can't change roles or active status
    if user_role_value != UserRole.SUPERVISOR.value:
        if update_data.role is not None or update_data.is_active is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot modify role or active status"
            )

    user = await repo.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    update_dict = update_data.model_dump(exclude_unset=True, exclude={"password"})

    # Handle password update
    if update_data.password:
        update_dict["hashed_password"] = get_password_hash(update_data.password)

    updated_user = await repo.update(user_id, update_dict)
    return UserResponse.model_validate(updated_user)
