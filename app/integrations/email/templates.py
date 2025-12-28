"""
Email Templates - PHI-safe email templates for client communication.

All templates follow HIPAA guidelines:
- No patient names, DOB, diagnosis, or detailed service descriptions
- Only reference IDs and secure portal links
- Instructions to use portal for sensitive information
"""

from typing import Optional


class EmailTemplates:
    """
    Email template generator for PHI-safe communications.
    """

    # Base styles for all emails
    BASE_STYLES = """
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e3a5f; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background: #1e3a5f; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        .footer { padding: 20px; font-size: 12px; color: #666; text-align: center; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .info-box { background: #e7f3ff; border-left: 4px solid #1e3a5f; padding: 15px; margin: 15px 0; }
    </style>
    """

    def _base_template(self, content: str, title: str = "Billing Request OS") -> str:
        """Wrap content in base HTML template."""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>{title}</title>
            {self.BASE_STYLES}
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{title}</h1>
                </div>
                <div class="content">
                    {content}
                </div>
                <div class="footer">
                    <p>This is an automated message. Please do not reply directly to this email.</p>
                    <p>For security, do not include sensitive information in email replies. Use the secure portal link provided.</p>
                </div>
            </div>
        </body>
        </html>
        """

    def client_request_email(
        self,
        request_id: str,
        request_type: str,
        account_reference: str,
        portal_url: str,
        client_name: Optional[str] = None
    ) -> str:
        """
        Generate email for sending billing request to client.

        PHI-Safe: No patient information included.
        """
        greeting = f"Hello {client_name} Team," if client_name else "Hello,"

        content = f"""
        <p>{greeting}</p>

        <p>We have received an inquiry regarding one of your accounts that requires your attention.</p>

        <div class="info-box">
            <p><strong>Reference Number:</strong> {request_id}</p>
            <p><strong>Account Number:</strong> {account_reference}</p>
            <p><strong>Inquiry Type:</strong> {request_type}</p>
        </div>

        <p>Please review this inquiry and provide your response via our secure portal:</p>

        <p style="text-align: center;">
            <a href="{portal_url}" class="button">Respond via Secure Portal</a>
        </p>

        <div class="warning">
            <strong>Security Notice:</strong> For HIPAA compliance, please do not send protected health information (PHI) via email.
            Use the secure portal link above to submit documents and detailed responses.
        </div>

        <p>If you have any questions, please contact our Client Services team.</p>

        <p>Thank you for your prompt attention.</p>
        """

        return self._base_template(content, "Billing Inquiry")

    def follow_up_email(
        self,
        request_id: str,
        account_reference: str,
        portal_url: str,
        days_waiting: int
    ) -> str:
        """
        Generate follow-up email for pending requests.
        """
        content = f"""
        <p>Hello,</p>

        <p>This is a follow-up regarding a billing inquiry that has been pending for <strong>{days_waiting} days</strong>.</p>

        <div class="info-box">
            <p><strong>Reference Number:</strong> {request_id}</p>
            <p><strong>Account Number:</strong> {account_reference}</p>
            <p><strong>Days Pending:</strong> {days_waiting}</p>
        </div>

        <p>Your timely response helps us resolve this matter efficiently. Please use the secure portal to submit your response:</p>

        <p style="text-align: center;">
            <a href="{portal_url}" class="button">Respond Now</a>
        </p>

        <p>If you have already responded, please disregard this message.</p>

        <p>Thank you for your cooperation.</p>
        """

        return self._base_template(content, "Follow-Up: Pending Inquiry")

    def resolution_notification_email(
        self,
        request_id: str,
        account_reference: str,
        resolution: str,
        collector_name: Optional[str] = None
    ) -> str:
        """
        Generate notification email for request resolution (internal).
        """
        greeting = f"Hello {collector_name}," if collector_name else "Hello,"

        content = f"""
        <p>{greeting}</p>

        <p>A billing request you submitted has been resolved.</p>

        <div class="info-box">
            <p><strong>Reference Number:</strong> {request_id}</p>
            <p><strong>Account Number:</strong> {account_reference}</p>
            <p><strong>Resolution:</strong> {resolution}</p>
        </div>

        <p>Please review the resolution and resume collection activity as appropriate.</p>

        <p>You can view the full details in the Billing Request OS system.</p>
        """

        return self._base_template(content, "Request Resolved")

    def portal_access_email(
        self,
        request_id: str,
        portal_url: str,
        expires_in_hours: int
    ) -> str:
        """
        Generate email with portal access link.
        """
        content = f"""
        <p>Hello,</p>

        <p>You have been granted access to respond to a billing inquiry.</p>

        <div class="info-box">
            <p><strong>Reference Number:</strong> {request_id}</p>
            <p><strong>Access Expires:</strong> {expires_in_hours} hours</p>
        </div>

        <p style="text-align: center;">
            <a href="{portal_url}" class="button">Access Secure Portal</a>
        </p>

        <div class="warning">
            <strong>Important:</strong> This link expires in {expires_in_hours} hours.
            Do not share this link with others.
        </div>

        <p>If you did not request this access, please contact us immediately.</p>
        """

        return self._base_template(content, "Portal Access")
