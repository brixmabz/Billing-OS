"""
PostgreSQL repository implementations using SQLAlchemy.
"""

from typing import Optional, List, Any
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import func, and_, or_

from app.db.base import RequestRepositoryInterface, UserRepositoryInterface, ClientRepositoryInterface
from app.models.request import BillingRequest, RequestStatus
from app.models.user import User
from app.models.client import Client


class PostgresRequestRepository(RequestRepositoryInterface):
    """PostgreSQL implementation of request repository."""

    def __init__(self, db: Session):
        self.db = db

    async def create(self, obj_in: dict) -> BillingRequest:
        """Create a new billing request."""
        db_obj = BillingRequest(**obj_in)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    async def get(self, id: int) -> Optional[BillingRequest]:
        """Get a request by ID."""
        return self.db.query(BillingRequest).filter(BillingRequest.id == id).first()

    async def get_by_request_id(self, request_id: str) -> Optional[BillingRequest]:
        """Get a request by its formatted request_id (REQ-####)."""
        return self.db.query(BillingRequest).filter(
            BillingRequest.request_id == request_id
        ).first()

    async def get_multi(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[dict] = None
    ) -> List[BillingRequest]:
        """Get multiple requests with optional filtering."""
        query = self.db.query(BillingRequest)

        if filters:
            if "status" in filters:
                query = query.filter(BillingRequest.status == filters["status"])
            if "collector_id" in filters:
                query = query.filter(BillingRequest.collector_id == filters["collector_id"])
            if "assigned_admin_id" in filters:
                query = query.filter(BillingRequest.assigned_admin_id == filters["assigned_admin_id"])
            if "client_id" in filters:
                query = query.filter(BillingRequest.client_id == filters["client_id"])
            if "agency_id" in filters:
                query = query.filter(BillingRequest.agency_id == filters["agency_id"])
            if "request_type" in filters:
                query = query.filter(BillingRequest.request_type == filters["request_type"])
            if "sla_breached" in filters:
                query = query.filter(BillingRequest.sla_breached == filters["sla_breached"])
            if "statuses" in filters:  # Multiple statuses
                query = query.filter(BillingRequest.status.in_(filters["statuses"]))

        query = query.order_by(BillingRequest.created_at.desc())
        return query.offset(skip).limit(limit).all()

    async def get_count(self, filters: Optional[dict] = None) -> int:
        """Get count of requests matching filters."""
        query = self.db.query(func.count(BillingRequest.id))

        if filters:
            if "status" in filters:
                query = query.filter(BillingRequest.status == filters["status"])
            if "collector_id" in filters:
                query = query.filter(BillingRequest.collector_id == filters["collector_id"])
            if "client_id" in filters:
                query = query.filter(BillingRequest.client_id == filters["client_id"])
            if "sla_breached" in filters:
                query = query.filter(BillingRequest.sla_breached == filters["sla_breached"])

        return query.scalar()

    async def update(self, id: int, obj_in: dict) -> Optional[BillingRequest]:
        """Update a request."""
        db_obj = await self.get(id)
        if not db_obj:
            return None

        for field, value in obj_in.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db_obj.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    async def delete(self, id: int) -> bool:
        """Delete a request."""
        db_obj = await self.get(id)
        if not db_obj:
            return False

        self.db.delete(db_obj)
        self.db.commit()
        return True

    async def get_by_dedupe_key(self, dedupe_key: str) -> Optional[BillingRequest]:
        """Get an open request by dedupe key for duplicate detection."""
        return self.db.query(BillingRequest).filter(
            and_(
                BillingRequest.dedupe_key == dedupe_key,
                BillingRequest.status.in_([
                    RequestStatus.OPEN,
                    RequestStatus.CLAIMED,
                    RequestStatus.SENT
                ])
            )
        ).first()

    async def get_breached_requests(self) -> List[BillingRequest]:
        """Get all requests that have breached SLA."""
        return self.db.query(BillingRequest).filter(
            BillingRequest.sla_breached == True
        ).order_by(BillingRequest.sla_due_at).all()

    async def get_by_status(self, status: str) -> List[BillingRequest]:
        """Get requests by status."""
        return self.db.query(BillingRequest).filter(
            BillingRequest.status == status
        ).order_by(BillingRequest.created_at.desc()).all()

    async def get_by_collector(self, collector_id: int) -> List[BillingRequest]:
        """Get requests created by a specific collector."""
        return self.db.query(BillingRequest).filter(
            BillingRequest.collector_id == collector_id
        ).order_by(BillingRequest.created_at.desc()).all()

    async def get_by_admin(self, admin_id: int) -> List[BillingRequest]:
        """Get requests assigned to a specific admin."""
        return self.db.query(BillingRequest).filter(
            BillingRequest.assigned_admin_id == admin_id
        ).order_by(BillingRequest.created_at.desc()).all()

    async def update_status(
        self,
        id: int,
        status: str,
        admin_id: Optional[int] = None,
        resolution_code: Optional[str] = None
    ) -> Optional[BillingRequest]:
        """Update request status with optional assignment and resolution."""
        db_obj = await self.get(id)
        if not db_obj:
            return None

        db_obj.status = status
        db_obj.updated_at = datetime.utcnow()

        # Set timestamp based on status
        if status == RequestStatus.CLAIMED:
            db_obj.claimed_at = datetime.utcnow()
            if admin_id:
                db_obj.assigned_admin_id = admin_id
        elif status == RequestStatus.SENT:
            db_obj.sent_at = datetime.utcnow()
        elif status == RequestStatus.RESPONDED:
            db_obj.responded_at = datetime.utcnow()
        elif status == RequestStatus.CLOSED:
            db_obj.closed_at = datetime.utcnow()
            if resolution_code:
                db_obj.resolution_code = resolution_code

        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    async def append_audit_log(self, id: int, event: dict) -> Optional[BillingRequest]:
        """Append an event to the request's audit log."""
        db_obj = await self.get(id)
        if not db_obj:
            return None

        # Create a new list to ensure SQLAlchemy detects the change
        current_log = list(db_obj.audit_log or [])
        current_log.append(event)
        db_obj.audit_log = current_log
        db_obj.updated_at = datetime.utcnow()

        # Explicitly mark the JSON column as modified
        flag_modified(db_obj, 'audit_log')

        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    async def get_next_sequence_number(self) -> int:
        """Get the next sequence number for request_id generation."""
        max_id = self.db.query(func.max(BillingRequest.id)).scalar()
        return (max_id or 0) + 1

    async def get_by_portal_token(self, token: str) -> Optional[BillingRequest]:
        """Get request by portal token."""
        return self.db.query(BillingRequest).filter(
            BillingRequest.portal_token == token
        ).first()

    async def get_requests_needing_sla_check(self) -> List[BillingRequest]:
        """Get requests that need SLA breach checking."""
        now = datetime.utcnow()
        return self.db.query(BillingRequest).filter(
            and_(
                BillingRequest.status.in_([
                    RequestStatus.OPEN,
                    RequestStatus.CLAIMED,
                    RequestStatus.SENT
                ]),
                BillingRequest.sla_breached == False,
                BillingRequest.sla_due_at <= now
            )
        ).all()


class PostgresUserRepository(UserRepositoryInterface):
    """PostgreSQL implementation of user repository."""

    def __init__(self, db: Session):
        self.db = db

    async def create(self, obj_in: dict) -> User:
        """Create a new user."""
        db_obj = User(**obj_in)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    async def get(self, id: int) -> Optional[User]:
        """Get a user by ID."""
        return self.db.query(User).filter(User.id == id).first()

    async def get_multi(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[dict] = None
    ) -> List[User]:
        """Get multiple users with optional filtering."""
        query = self.db.query(User)

        if filters:
            if "role" in filters:
                query = query.filter(User.role == filters["role"])
            if "is_active" in filters:
                query = query.filter(User.is_active == filters["is_active"])
            if "team" in filters:
                query = query.filter(User.team == filters["team"])

        return query.offset(skip).limit(limit).all()

    async def update(self, id: int, obj_in: dict) -> Optional[User]:
        """Update a user."""
        db_obj = await self.get(id)
        if not db_obj:
            return None

        for field, value in obj_in.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db_obj.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    async def delete(self, id: int) -> bool:
        """Delete a user."""
        db_obj = await self.get(id)
        if not db_obj:
            return False

        self.db.delete(db_obj)
        self.db.commit()
        return True

    async def get_by_username(self, username: str) -> Optional[User]:
        """Get a user by username."""
        return self.db.query(User).filter(User.username == username).first()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Get a user by email."""
        return self.db.query(User).filter(User.email == email).first()

    async def get_by_role(self, role: str) -> List[User]:
        """Get all users with a specific role."""
        return self.db.query(User).filter(
            and_(User.role == role, User.is_active == True)
        ).all()


class PostgresClientRepository(ClientRepositoryInterface):
    """PostgreSQL implementation of client repository."""

    def __init__(self, db: Session):
        self.db = db

    async def create(self, obj_in: dict) -> Client:
        """Create a new client."""
        db_obj = Client(**obj_in)
        self.db.add(db_obj)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    async def get(self, id: int) -> Optional[Client]:
        """Get a client by ID."""
        return self.db.query(Client).filter(Client.id == id).first()

    async def get_multi(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[dict] = None
    ) -> List[Client]:
        """Get multiple clients with optional filtering."""
        query = self.db.query(Client)

        if filters:
            if "is_active" in filters:
                query = query.filter(Client.is_active == filters["is_active"])

        return query.offset(skip).limit(limit).all()

    async def update(self, id: int, obj_in: dict) -> Optional[Client]:
        """Update a client."""
        db_obj = await self.get(id)
        if not db_obj:
            return None

        for field, value in obj_in.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db_obj.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    async def delete(self, id: int) -> bool:
        """Delete a client."""
        db_obj = await self.get(id)
        if not db_obj:
            return False

        self.db.delete(db_obj)
        self.db.commit()
        return True

    async def get_by_code(self, code: str) -> Optional[Client]:
        """Get a client by their code."""
        return self.db.query(Client).filter(Client.code == code).first()

    async def get_active_clients(self) -> List[Client]:
        """Get all active clients."""
        return self.db.query(Client).filter(Client.is_active == True).all()
