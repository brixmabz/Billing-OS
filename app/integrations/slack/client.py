"""
Slack Client - Handles all Slack API interactions.

Posts notifications for new requests, status updates, and SLA breaches.
"""

from typing import Optional, Dict, Any, List
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from app.core.config import settings
from app.models.request import BillingRequest


class SlackClient:
    """
    Client for Slack Web API interactions.
    """

    def __init__(self):
        self.enabled = settings.SLACK_ENABLED and bool(settings.SLACK_BOT_TOKEN)
        self.client = WebClient(token=settings.SLACK_BOT_TOKEN) if self.enabled else None
        self.default_channel = settings.SLACK_CHANNEL_ID

    def _is_enabled(self) -> bool:
        """Check if Slack is enabled and configured."""
        return self.enabled and self.client is not None

    async def post_message(
        self,
        text: str,
        blocks: Optional[List[Dict]] = None,
        channel: Optional[str] = None,
        thread_ts: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Post a message to Slack.

        Args:
            text: Fallback text for notifications
            blocks: Block Kit blocks for rich formatting
            channel: Channel ID (uses default if not specified)
            thread_ts: Thread timestamp for replies

        Returns:
            Slack API response or None if disabled
        """
        if not self._is_enabled():
            print(f"[Slack Disabled] Would post: {text}")
            return None

        try:
            response = self.client.chat_postMessage(
                channel=channel or self.default_channel,
                text=text,
                blocks=blocks,
                thread_ts=thread_ts
            )
            return {
                "ok": response["ok"],
                "ts": response["ts"],
                "channel": response["channel"]
            }
        except SlackApiError as e:
            print(f"Slack API error: {e.response['error']}")
            return None

    async def update_message(
        self,
        channel: str,
        ts: str,
        text: str,
        blocks: Optional[List[Dict]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Update an existing Slack message.

        Args:
            channel: Channel ID
            ts: Message timestamp
            text: Updated text
            blocks: Updated blocks

        Returns:
            Slack API response or None if disabled
        """
        if not self._is_enabled():
            return None

        try:
            response = self.client.chat_update(
                channel=channel,
                ts=ts,
                text=text,
                blocks=blocks
            )
            return {"ok": response["ok"], "ts": response["ts"]}
        except SlackApiError as e:
            print(f"Slack API error: {e.response['error']}")
            return None

    async def post_new_request(self, request: BillingRequest) -> Optional[Dict[str, Any]]:
        """
        Post notification for a new billing request.

        Args:
            request: The new billing request

        Returns:
            Slack response with message timestamp
        """
        from .messages import SlackMessageBuilder

        builder = SlackMessageBuilder()
        message = builder.new_request_message(request)

        result = await self.post_message(
            text=message["text"],
            blocks=message["blocks"]
        )

        return result

    async def post_status_update(
        self,
        request: BillingRequest,
        channel: str,
        thread_ts: str
    ) -> Optional[Dict[str, Any]]:
        """
        Post a status update as a thread reply.

        Args:
            request: The updated request
            channel: Original message channel
            thread_ts: Original message timestamp

        Returns:
            Slack response
        """
        from .messages import SlackMessageBuilder

        builder = SlackMessageBuilder()
        message = builder.status_update_message(request)

        return await self.post_message(
            text=message["text"],
            blocks=message.get("blocks"),
            channel=channel,
            thread_ts=thread_ts
        )

    async def post_sla_breach(
        self,
        request: BillingRequest,
        breach_type: str
    ) -> Optional[Dict[str, Any]]:
        """
        Post SLA breach alert.

        Args:
            request: The breached request
            breach_type: Type of breach

        Returns:
            Slack response
        """
        from .messages import SlackMessageBuilder

        builder = SlackMessageBuilder()
        message = builder.sla_breach_message(request, breach_type)

        return await self.post_message(
            text=message["text"],
            blocks=message["blocks"]
        )

    async def send_dm(
        self,
        user_id: str,
        text: str,
        blocks: Optional[List[Dict]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Send a direct message to a user.

        Args:
            user_id: Slack user ID
            text: Message text
            blocks: Optional blocks

        Returns:
            Slack response
        """
        if not self._is_enabled():
            return None

        try:
            # Open DM channel
            response = self.client.conversations_open(users=[user_id])
            channel = response["channel"]["id"]

            # Send message
            return await self.post_message(text=text, blocks=blocks, channel=channel)
        except SlackApiError as e:
            print(f"Slack API error: {e.response['error']}")
            return None


# Singleton instance
_slack_client: Optional[SlackClient] = None


def get_slack_client() -> SlackClient:
    """Get or create Slack client instance."""
    global _slack_client
    if _slack_client is None:
        _slack_client = SlackClient()
    return _slack_client
