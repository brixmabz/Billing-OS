"""
Resend Email Client - Handles email sending via Resend API.

All emails are PHI-safe - contain only reference IDs and portal links.
"""

from typing import Optional, Dict, Any, List
import resend

from app.core.config import settings


class ResendClient:
    """
    Client for Resend email API.
    """

    def __init__(self):
        self.enabled = settings.EMAIL_ENABLED and bool(settings.RESEND_API_KEY)
        if self.enabled:
            resend.api_key = settings.RESEND_API_KEY
        self.from_email = settings.EMAIL_FROM

    def _is_enabled(self) -> bool:
        """Check if email is enabled and configured."""
        return self.enabled

    async def send_email(
        self,
        to: str | List[str],
        subject: str,
        html: str,
        text: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Send an email via Resend.

        Args:
            to: Recipient email(s)
            subject: Email subject
            html: HTML body
            text: Plain text body (optional)
            reply_to: Reply-to address (optional)

        Returns:
            Resend API response or None if disabled
        """
        if not self._is_enabled():
            print(f"[Email Disabled] Would send to {to}: {subject}")
            return {"id": "disabled", "to": to}

        try:
            params = {
                "from": self.from_email,
                "to": to if isinstance(to, list) else [to],
                "subject": subject,
                "html": html,
            }

            if text:
                params["text"] = text
            if reply_to:
                params["reply_to"] = reply_to

            response = resend.Emails.send(params)
            return {"id": response.get("id"), "to": to}

        except Exception as e:
            print(f"Resend error: {str(e)}")
            return None

    async def send_client_request(
        self,
        to: str,
        request_id: str,
        request_type: str,
        account_reference: str,
        portal_url: str,
        client_name: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Send billing request email to client.

        PHI-Safe: Contains only account reference and portal link.

        Args:
            to: Client email
            request_id: The request ID (REQ-####)
            request_type: Human-readable request type
            account_reference: Account number
            portal_url: Secure portal URL for response
            client_name: Client/provider name for greeting

        Returns:
            Send result
        """
        from .templates import EmailTemplates

        templates = EmailTemplates()
        html = templates.client_request_email(
            request_id=request_id,
            request_type=request_type,
            account_reference=account_reference,
            portal_url=portal_url,
            client_name=client_name
        )

        subject = f"Inquiry re: Account #{account_reference} - Reference #{request_id}"

        return await self.send_email(
            to=to,
            subject=subject,
            html=html
        )

    async def send_follow_up(
        self,
        to: str,
        request_id: str,
        account_reference: str,
        portal_url: str,
        days_waiting: int
    ) -> Optional[Dict[str, Any]]:
        """
        Send follow-up reminder to client.

        Args:
            to: Client email
            request_id: The request ID
            account_reference: Account number
            portal_url: Portal URL
            days_waiting: Days since request was sent

        Returns:
            Send result
        """
        from .templates import EmailTemplates

        templates = EmailTemplates()
        html = templates.follow_up_email(
            request_id=request_id,
            account_reference=account_reference,
            portal_url=portal_url,
            days_waiting=days_waiting
        )

        subject = f"Follow-Up: Account #{account_reference} - Reference #{request_id}"

        return await self.send_email(
            to=to,
            subject=subject,
            html=html
        )

    async def send_resolution_notification(
        self,
        to: str,
        request_id: str,
        account_reference: str,
        resolution: str,
        collector_name: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Notify collector that request has been resolved.

        Args:
            to: Collector email
            request_id: The request ID
            account_reference: Account number
            resolution: Resolution summary
            collector_name: Collector's name for greeting

        Returns:
            Send result
        """
        from .templates import EmailTemplates

        templates = EmailTemplates()
        html = templates.resolution_notification_email(
            request_id=request_id,
            account_reference=account_reference,
            resolution=resolution,
            collector_name=collector_name
        )

        subject = f"Request Resolved: {request_id}"

        return await self.send_email(
            to=to,
            subject=subject,
            html=html
        )


# Singleton instance
_email_client: Optional[ResendClient] = None


def get_email_client() -> ResendClient:
    """Get or create email client instance."""
    global _email_client
    if _email_client is None:
        _email_client = ResendClient()
    return _email_client
