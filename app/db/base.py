"""
Abstract base repository interfaces.
Defines contracts that both PostgreSQL and Supabase implementations must follow.
"""

from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional, List, Any

T = TypeVar('T')


class BaseRepository(ABC, Generic[T]):
    """Abstract base repository with CRUD operations."""

    @abstractmethod
    async def create(self, obj_in: dict) -> T:
        """Create a new record."""
        pass

    @abstractmethod
    async def get(self, id: Any) -> Optional[T]:
        """Get a record by ID."""
        pass

    @abstractmethod
    async def get_multi(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[dict] = None
    ) -> List[T]:
        """Get multiple records with optional filtering."""
        pass

    @abstractmethod
    async def update(self, id: Any, obj_in: dict) -> Optional[T]:
        """Update a record."""
        pass

    @abstractmethod
    async def delete(self, id: Any) -> bool:
        """Delete a record."""
        pass


class RequestRepositoryInterface(BaseRepository[Any]):
    """Interface for request repository operations."""

    @abstractmethod
    async def get_by_request_id(self, request_id: str) -> Optional[Any]:
        """Get a request by its formatted request_id (REQ-####)."""
        pass

    @abstractmethod
    async def get_by_dedupe_key(self, dedupe_key: str) -> Optional[Any]:
        """Get an open request by dedupe key for duplicate detection."""
        pass

    @abstractmethod
    async def get_breached_requests(self) -> List[Any]:
        """Get all requests that have breached SLA."""
        pass

    @abstractmethod
    async def get_by_status(self, status: str) -> List[Any]:
        """Get requests by status."""
        pass

    @abstractmethod
    async def get_by_collector(self, collector_id: str) -> List[Any]:
        """Get requests created by a specific collector."""
        pass

    @abstractmethod
    async def get_by_admin(self, admin_id: str) -> List[Any]:
        """Get requests assigned to a specific admin."""
        pass

    @abstractmethod
    async def update_status(
        self,
        id: Any,
        status: str,
        admin_id: Optional[str] = None,
        resolution_code: Optional[str] = None
    ) -> Optional[Any]:
        """Update request status with optional assignment and resolution."""
        pass

    @abstractmethod
    async def append_audit_log(self, id: Any, event: dict) -> Optional[Any]:
        """Append an event to the request's audit log."""
        pass

    @abstractmethod
    async def get_next_sequence_number(self) -> int:
        """Get the next sequence number for request_id generation."""
        pass


class UserRepositoryInterface(BaseRepository[Any]):
    """Interface for user repository operations."""

    @abstractmethod
    async def get_by_username(self, username: str) -> Optional[Any]:
        """Get a user by username."""
        pass

    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[Any]:
        """Get a user by email."""
        pass

    @abstractmethod
    async def get_by_role(self, role: str) -> List[Any]:
        """Get all users with a specific role."""
        pass


class ClientRepositoryInterface(BaseRepository[Any]):
    """Interface for client repository operations."""

    @abstractmethod
    async def get_by_code(self, code: str) -> Optional[Any]:
        """Get a client by their code."""
        pass

    @abstractmethod
    async def get_active_clients(self) -> List[Any]:
        """Get all active clients."""
        pass
