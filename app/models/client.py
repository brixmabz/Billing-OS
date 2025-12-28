"""
Client model - Represents healthcare providers/clients.
"""

from sqlalchemy import Column, String, Integer, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.postgres.connection import Base


class Client(Base):
    """
    Client model representing healthcare providers that use the collection service.
    """
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(20), unique=True, nullable=False, index=True)  # Short code (e.g., "ABC")
    name = Column(String(200), nullable=False)  # Full name (e.g., "ABC Hospital")

    # Contact info
    email = Column(String(100), nullable=False)  # Primary contact email for requests
    contact_name = Column(String(100), nullable=True)  # Primary contact person
    phone = Column(String(20), nullable=True)

    # Additional contacts (for escalations, etc.)
    additional_contacts = Column(JSON, default=list)  # [{name, email, role}]

    # SLA configuration
    sla_hours = Column(Integer, default=72)  # Default SLA hours for this client

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    requests = relationship("BillingRequest", back_populates="client")

    def __repr__(self):
        return f"<Client {self.code}: {self.name}>"

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "code": self.code,
            "name": self.name,
            "email": self.email,
            "contact_name": self.contact_name,
            "phone": self.phone,
            "additional_contacts": self.additional_contacts,
            "sla_hours": self.sla_hours,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
