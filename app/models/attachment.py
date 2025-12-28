"""
Attachment model - File attachments for requests.
"""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, BigInteger, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.postgres.connection import Base


class Attachment(Base):
    """
    File attachment model for documents uploaded to requests.
    """
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("billing_requests.id"), nullable=False, index=True)

    # File info
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)  # Original uploaded name
    mime_type = Column(String(100), nullable=False)
    size = Column(BigInteger, nullable=False)  # File size in bytes

    # Storage
    storage_path = Column(String(500), nullable=False)  # Path in storage system
    storage_provider = Column(String(50), default="local")  # local, s3, supabase, etc.

    # Metadata
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Null if uploaded by client
    uploaded_by_client = Column(Boolean, default=False)  # True if uploaded via client portal
    description = Column(String(500), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    request = relationship("BillingRequest", back_populates="attachments")

    def __repr__(self):
        return f"<Attachment {self.filename} for Request {self.request_id}>"

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "request_id": self.request_id,
            "filename": self.filename,
            "original_filename": self.original_filename,
            "mime_type": self.mime_type,
            "size": self.size,
            "uploaded_by": self.uploaded_by,
            "uploaded_by_client": self.uploaded_by_client,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    @property
    def size_formatted(self) -> str:
        """Return human-readable file size."""
        size = self.size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f"{size:.1f} {unit}"
            size /= 1024
        return f"{size:.1f} TB"
