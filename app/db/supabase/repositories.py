"""
Supabase repository implementations.

These implement the same interfaces as the PostgreSQL repositories,
allowing seamless switching between database providers.
"""

from typing import Optional, List, Any
from datetime import datetime

from app.db.base import RequestRepositoryInterface, UserRepositoryInterface, ClientRepositoryInterface
from app.db.supabase.connection import get_supabase_client


class SupabaseRequestRepository(RequestRepositoryInterface):
    """Supabase implementation of request repository."""

    def __init__(self):
        self.client = get_supabase_client()
        self.table = "billing_requests"

    async def create(self, obj_in: dict) -> dict:
        """Create a new billing request."""
        response = self.client.table(self.table).insert(obj_in).execute()
        return response.data[0] if response.data else None

    async def get(self, id: int) -> Optional[dict]:
        """Get a request by ID."""
        response = self.client.table(self.table).select("*").eq("id", id).execute()
        return response.data[0] if response.data else None

    async def get_by_request_id(self, request_id: str) -> Optional[dict]:
        """Get a request by its formatted request_id (REQ-####)."""
        response = self.client.table(self.table).select("*").eq("request_id", request_id).execute()
        return response.data[0] if response.data else None

    async def get_multi(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[dict] = None
    ) -> List[dict]:
        """Get multiple requests with optional filtering."""
        query = self.client.table(self.table).select("*")

        if filters:
            if "status" in filters:
                query = query.eq("status", filters["status"])
            if "collector_id" in filters:
                query = query.eq("collector_id", filters["collector_id"])
            if "assigned_admin_id" in filters:
                query = query.eq("assigned_admin_id", filters["assigned_admin_id"])
            if "client_id" in filters:
                query = query.eq("client_id", filters["client_id"])
            if "agency_id" in filters:
                query = query.eq("agency_id", filters["agency_id"])
            if "request_type" in filters:
                query = query.eq("request_type", filters["request_type"])
            if "sla_breached" in filters:
                query = query.eq("sla_breached", filters["sla_breached"])
            if "statuses" in filters:
                query = query.in_("status", filters["statuses"])

        query = query.order("created_at", desc=True)
        query = query.range(skip, skip + limit - 1)

        response = query.execute()
        return response.data or []

    async def get_count(self, filters: Optional[dict] = None) -> int:
        """Get count of requests matching filters."""
        query = self.client.table(self.table).select("id", count="exact")

        if filters:
            if "status" in filters:
                query = query.eq("status", filters["status"])
            if "collector_id" in filters:
                query = query.eq("collector_id", filters["collector_id"])
            if "client_id" in filters:
                query = query.eq("client_id", filters["client_id"])
            if "sla_breached" in filters:
                query = query.eq("sla_breached", filters["sla_breached"])

        response = query.execute()
        return response.count or 0

    async def update(self, id: int, obj_in: dict) -> Optional[dict]:
        """Update a request."""
        obj_in["updated_at"] = datetime.utcnow().isoformat()
        response = self.client.table(self.table).update(obj_in).eq("id", id).execute()
        return response.data[0] if response.data else None

    async def delete(self, id: int) -> bool:
        """Delete a request."""
        response = self.client.table(self.table).delete().eq("id", id).execute()
        return len(response.data) > 0 if response.data else False

    async def get_by_dedupe_key(self, dedupe_key: str) -> Optional[dict]:
        """Get an open request by dedupe key for duplicate detection."""
        response = (
            self.client.table(self.table)
            .select("*")
            .eq("dedupe_key", dedupe_key)
            .in_("status", ["OPEN", "CLAIMED", "SENT"])
            .execute()
        )
        return response.data[0] if response.data else None

    async def get_breached_requests(self) -> List[dict]:
        """Get all requests that have breached SLA."""
        response = (
            self.client.table(self.table)
            .select("*")
            .eq("sla_breached", True)
            .order("sla_due_at")
            .execute()
        )
        return response.data or []

    async def get_by_status(self, status: str) -> List[dict]:
        """Get requests by status."""
        response = (
            self.client.table(self.table)
            .select("*")
            .eq("status", status)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    async def get_by_collector(self, collector_id: int) -> List[dict]:
        """Get requests created by a specific collector."""
        response = (
            self.client.table(self.table)
            .select("*")
            .eq("collector_id", collector_id)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    async def get_by_admin(self, admin_id: int) -> List[dict]:
        """Get requests assigned to a specific admin."""
        response = (
            self.client.table(self.table)
            .select("*")
            .eq("assigned_admin_id", admin_id)
            .order("created_at", desc=True)
            .execute()
        )
        return response.data or []

    async def update_status(
        self,
        id: int,
        status: str,
        admin_id: Optional[int] = None,
        resolution_code: Optional[str] = None
    ) -> Optional[dict]:
        """Update request status with optional assignment and resolution."""
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat()
        }

        # Set timestamp based on status
        now = datetime.utcnow().isoformat()
        if status == "CLAIMED":
            update_data["claimed_at"] = now
            if admin_id:
                update_data["assigned_admin_id"] = admin_id
        elif status == "SENT":
            update_data["sent_at"] = now
        elif status == "RESPONDED":
            update_data["responded_at"] = now
        elif status == "CLOSED":
            update_data["closed_at"] = now
            if resolution_code:
                update_data["resolution_code"] = resolution_code

        response = self.client.table(self.table).update(update_data).eq("id", id).execute()
        return response.data[0] if response.data else None

    async def append_audit_log(self, id: int, event: dict) -> Optional[dict]:
        """Append an event to the request's audit log."""
        # Get current audit log
        current = await self.get(id)
        if not current:
            return None

        audit_log = current.get("audit_log", []) or []
        audit_log.append(event)

        response = (
            self.client.table(self.table)
            .update({
                "audit_log": audit_log,
                "updated_at": datetime.utcnow().isoformat()
            })
            .eq("id", id)
            .execute()
        )
        return response.data[0] if response.data else None

    async def get_next_sequence_number(self) -> int:
        """Get the next sequence number for request_id generation."""
        response = (
            self.client.table(self.table)
            .select("id")
            .order("id", desc=True)
            .limit(1)
            .execute()
        )
        if response.data:
            return response.data[0]["id"] + 1
        return 1

    async def get_by_portal_token(self, token: str) -> Optional[dict]:
        """Get request by portal token."""
        response = (
            self.client.table(self.table)
            .select("*")
            .eq("portal_token", token)
            .execute()
        )
        return response.data[0] if response.data else None

    async def get_requests_needing_sla_check(self) -> List[dict]:
        """Get requests that need SLA breach checking."""
        now = datetime.utcnow().isoformat()
        response = (
            self.client.table(self.table)
            .select("*")
            .in_("status", ["OPEN", "CLAIMED", "SENT"])
            .eq("sla_breached", False)
            .lte("sla_due_at", now)
            .execute()
        )
        return response.data or []


class SupabaseUserRepository(UserRepositoryInterface):
    """Supabase implementation of user repository."""

    def __init__(self):
        self.client = get_supabase_client()
        self.table = "users"

    async def create(self, obj_in: dict) -> dict:
        """Create a new user."""
        response = self.client.table(self.table).insert(obj_in).execute()
        return response.data[0] if response.data else None

    async def get(self, id: int) -> Optional[dict]:
        """Get a user by ID."""
        response = self.client.table(self.table).select("*").eq("id", id).execute()
        return response.data[0] if response.data else None

    async def get_multi(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[dict] = None
    ) -> List[dict]:
        """Get multiple users with optional filtering."""
        query = self.client.table(self.table).select("*")

        if filters:
            if "role" in filters:
                query = query.eq("role", filters["role"])
            if "is_active" in filters:
                query = query.eq("is_active", filters["is_active"])
            if "team" in filters:
                query = query.eq("team", filters["team"])

        query = query.range(skip, skip + limit - 1)
        response = query.execute()
        return response.data or []

    async def update(self, id: int, obj_in: dict) -> Optional[dict]:
        """Update a user."""
        obj_in["updated_at"] = datetime.utcnow().isoformat()
        response = self.client.table(self.table).update(obj_in).eq("id", id).execute()
        return response.data[0] if response.data else None

    async def delete(self, id: int) -> bool:
        """Delete a user."""
        response = self.client.table(self.table).delete().eq("id", id).execute()
        return len(response.data) > 0 if response.data else False

    async def get_by_username(self, username: str) -> Optional[dict]:
        """Get a user by username."""
        response = self.client.table(self.table).select("*").eq("username", username).execute()
        return response.data[0] if response.data else None

    async def get_by_email(self, email: str) -> Optional[dict]:
        """Get a user by email."""
        response = self.client.table(self.table).select("*").eq("email", email).execute()
        return response.data[0] if response.data else None

    async def get_by_role(self, role: str) -> List[dict]:
        """Get all users with a specific role."""
        response = (
            self.client.table(self.table)
            .select("*")
            .eq("role", role)
            .eq("is_active", True)
            .execute()
        )
        return response.data or []


class SupabaseClientRepository(ClientRepositoryInterface):
    """Supabase implementation of client repository."""

    def __init__(self):
        self.client = get_supabase_client()
        self.table = "clients"

    async def create(self, obj_in: dict) -> dict:
        """Create a new client."""
        response = self.client.table(self.table).insert(obj_in).execute()
        return response.data[0] if response.data else None

    async def get(self, id: int) -> Optional[dict]:
        """Get a client by ID."""
        response = self.client.table(self.table).select("*").eq("id", id).execute()
        return response.data[0] if response.data else None

    async def get_multi(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: Optional[dict] = None
    ) -> List[dict]:
        """Get multiple clients with optional filtering."""
        query = self.client.table(self.table).select("*")

        if filters:
            if "is_active" in filters:
                query = query.eq("is_active", filters["is_active"])

        query = query.range(skip, skip + limit - 1)
        response = query.execute()
        return response.data or []

    async def update(self, id: int, obj_in: dict) -> Optional[dict]:
        """Update a client."""
        obj_in["updated_at"] = datetime.utcnow().isoformat()
        response = self.client.table(self.table).update(obj_in).eq("id", id).execute()
        return response.data[0] if response.data else None

    async def delete(self, id: int) -> bool:
        """Delete a client."""
        response = self.client.table(self.table).delete().eq("id", id).execute()
        return len(response.data) > 0 if response.data else False

    async def get_by_code(self, code: str) -> Optional[dict]:
        """Get a client by their code."""
        response = self.client.table(self.table).select("*").eq("code", code).execute()
        return response.data[0] if response.data else None

    async def get_active_clients(self) -> List[dict]:
        """Get all active clients."""
        response = self.client.table(self.table).select("*").eq("is_active", True).execute()
        return response.data or []
