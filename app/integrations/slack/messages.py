"""
Slack Message Builder - Creates formatted Slack messages.

All messages are PHI-safe - no patient names, DOB, or sensitive data.
Only reference IDs and status information are included.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime

from app.models.request import BillingRequest, RequestStatus


# Human-readable request type names
REQUEST_TYPE_NAMES = {
    "insurance_coverage_claim": "Insurance Coverage Claim",
    "wrong_insurance_refile": "Wrong Insurance / Refile",
    "auto_accident_3rd_party": "Auto Accident / 3rd Party",
    "medicaid_medicare_question": "Medicaid/Medicare Question",
    "paid_direct_to_provider": "Paid Direct to Provider",
    "on_payment_plan": "On Payment Plan",
    "payment_posted_wrong": "Payment Posted Wrong",
    "not_our_patient": "Not Our Patient",
    "identity_theft_fraud": "Identity Theft / Fraud",
    "itemized_bill_request": "Itemized Bill Request",
    "validation_package_request": "Validation Package Request",
    "statement_resend": "Statement Resend",
    "overcharged_balance_incorrect": "Overcharged / Balance Incorrect",
    "service_cancelled_not_billed": "Service Cancelled / Not Billed",
}

# Status emojis
STATUS_EMOJI = {
    "OPEN": ":inbox_tray:",
    "CLAIMED": ":eyes:",
    "SENT": ":outbox_tray:",
    "RESPONDED": ":white_check_mark:",
    "CLOSED": ":heavy_check_mark:",
}

# Priority indicators
PRIORITY_EMOJI = {
    "NORMAL": "",
    "HIGH": ":rotating_light:",
}


class SlackMessageBuilder:
    """
    Builder for Slack Block Kit messages.
    """

    def _get_type_name(self, request_type: str) -> str:
        """Get human-readable request type name."""
        return REQUEST_TYPE_NAMES.get(request_type, request_type)

    def _get_status_emoji(self, status: str) -> str:
        """Get emoji for status."""
        return STATUS_EMOJI.get(status, ":question:")

    def new_request_message(self, request: BillingRequest) -> Dict[str, Any]:
        """
        Build message for new request notification.

        PHI-Safe: Only includes request ID, type, client, and status.
        """
        type_name = self._get_type_name(request.request_type)
        priority_emoji = PRIORITY_EMOJI.get(request.priority, "")

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{priority_emoji} New Request: {request.request_id}".strip(),
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Agency:*\n{request.agency_id}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Client:*\n{request.client.name if request.client else 'Unknown'}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Type:*\n{type_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Account Ref:*\n{request.account_reference}"
                    }
                ]
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Created By:*\n{request.collector.full_name if request.collector else 'Unknown'}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Priority:*\n{request.priority}"
                    }
                ]
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f":clock1: SLA Due: {request.sla_due_at.strftime('%b %d, %I:%M %p') if request.sla_due_at else 'Not set'}"
                    }
                ]
            },
            {
                "type": "divider"
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Claim",
                            "emoji": True
                        },
                        "style": "primary",
                        "action_id": "claim_request",
                        "value": request.request_id
                    },
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "View Details",
                            "emoji": True
                        },
                        "action_id": "view_request",
                        "value": request.request_id
                    }
                ]
            }
        ]

        return {
            "text": f"New billing request {request.request_id}: {type_name}",
            "blocks": blocks
        }

    def status_update_message(self, request: BillingRequest) -> Dict[str, Any]:
        """
        Build message for status update (thread reply).
        """
        status_emoji = self._get_status_emoji(request.status)
        admin_name = request.assigned_admin.full_name if request.assigned_admin else "Unassigned"

        text = f"{status_emoji} Status updated to *{request.status}*"

        if request.status == RequestStatus.CLAIMED.value:
            text += f" by {admin_name}"
        elif request.status == RequestStatus.SENT.value:
            text += " - Awaiting client response"
        elif request.status == RequestStatus.RESPONDED.value:
            text += " - Client has responded"
        elif request.status == RequestStatus.CLOSED.value:
            resolution = request.resolution_code if request.resolution_code else "N/A"
            text += f" - Resolution: {resolution}"

        return {
            "text": text,
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": text
                    }
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": f":clock1: Updated at {datetime.utcnow().strftime('%b %d, %I:%M %p')} UTC"
                        }
                    ]
                }
            ]
        }

    def sla_breach_message(self, request: BillingRequest, breach_type: str) -> Dict[str, Any]:
        """
        Build SLA breach alert message.
        """
        type_name = self._get_type_name(request.request_type)

        breach_descriptions = {
            "unclaimed": "Request has been unclaimed for over 15 minutes",
            "not_sent": "Request has been claimed but not sent for over 4 hours",
            "client_warning": "Client has not responded in 3 days",
            "client_breach": "Client has not responded in 7 days - ESCALATION REQUIRED",
            "overdue": "Request is past its SLA due date",
        }

        description = breach_descriptions.get(breach_type, "SLA breach detected")

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": ":warning: SLA Breach Alert",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{request.request_id}* - {type_name}\n{description}"
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Client:*\n{request.client.name if request.client else 'Unknown'}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Status:*\n{request.status}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Assigned To:*\n{request.assigned_admin.full_name if request.assigned_admin else 'Unassigned'}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*SLA Due:*\n{request.sla_due_at.strftime('%b %d, %I:%M %p') if request.sla_due_at else 'Not set'}"
                    }
                ]
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Take Action",
                            "emoji": True
                        },
                        "style": "danger",
                        "action_id": "handle_breach",
                        "value": request.request_id
                    }
                ]
            }
        ]

        return {
            "text": f"SLA Breach: {request.request_id} - {description}",
            "blocks": blocks
        }

    def client_response_message(self, request: BillingRequest) -> Dict[str, Any]:
        """
        Build notification for client response.
        """
        return {
            "text": f":white_check_mark: Client responded to {request.request_id}",
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f":white_check_mark: *Client Response Received*\nRequest {request.request_id} has received a response via the portal."
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Review Response",
                                "emoji": True
                            },
                            "style": "primary",
                            "action_id": "review_response",
                            "value": request.request_id
                        }
                    ]
                }
            ]
        }
