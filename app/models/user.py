"""
User model for authentication and authorization.
"""

from sqlalchemy import Column, String, Integer, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.db.postgres.connection import Base


class UserRole(str, enum.Enum):
    """User roles with different permissions."""
    COLLECTOR = "collector"     # Can create requests, view own requests
    ADMIN = "admin"             # Can claim, process, and send requests
    SUPERVISOR = "supervisor"   # Can view all, access analytics dashboard


class User(Base):
    """
    User model for authentication and role-based access control.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Profile
    full_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default="collector")
    team = Column(String(50), nullable=True)  # Optional team/group assignment
    avatar_url = Column(String(255), nullable=True)

    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    # Relationships
    created_requests = relationship(
        "BillingRequest",
        foreign_keys="BillingRequest.collector_id",
        back_populates="collector"
    )
    assigned_requests = relationship(
        "BillingRequest",
        foreign_keys="BillingRequest.assigned_admin_id",
        back_populates="assigned_admin"
    )

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses (excludes password)."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "full_name": self.full_name,
            "role": self.role,
            "team": self.team,
            "avatar_url": self.avatar_url,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
        }

    def has_role(self, role: UserRole) -> bool:
        """Check if user has a specific role."""
        return self.role == role

    def can_create_requests(self) -> bool:
        """Check if user can create billing requests."""
        return self.role in [UserRole.COLLECTOR, UserRole.ADMIN, UserRole.SUPERVISOR]

    def can_claim_requests(self) -> bool:
        """Check if user can claim requests."""
        return self.role in [UserRole.ADMIN, UserRole.SUPERVISOR]

    def can_view_dashboard(self) -> bool:
        """Check if user can view supervisor dashboard."""
        return self.role == UserRole.SUPERVISOR

    def can_manage_users(self) -> bool:
        """Check if user can manage other users."""
        return self.role == UserRole.SUPERVISOR
