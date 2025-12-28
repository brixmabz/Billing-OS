"""
Pydantic schemas for Client validation and serialization.
"""

from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, List
from datetime import datetime


class ClientContact(BaseModel):
    """Additional contact for a client."""
    name: str
    email: EmailStr
    role: Optional[str] = None  # e.g., "Billing Manager", "Escalation Contact"


class ClientBase(BaseModel):
    """Base schema for client data."""
    code: str = Field(..., min_length=2, max_length=20)
    name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    contact_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    additional_contacts: List[ClientContact] = []
    sla_hours: int = Field(default=72, ge=1, le=720)


class ClientCreate(ClientBase):
    """Schema for creating a new client."""
    pass


class ClientUpdate(BaseModel):
    """Schema for updating a client."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    contact_name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    additional_contacts: Optional[List[ClientContact]] = None
    sla_hours: Optional[int] = Field(None, ge=1, le=720)
    is_active: Optional[bool] = None


class ClientResponse(BaseModel):
    """Schema for client API responses."""
    id: int
    code: str
    name: str
    email: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    additional_contacts: List[ClientContact] = []
    sla_hours: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientListResponse(BaseModel):
    """Schema for list of clients."""
    items: List[ClientResponse]
    total: int
