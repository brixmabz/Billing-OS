"""
Common validation utilities.
"""

import re
from typing import Optional
import html


# Email validation pattern (RFC 5322 simplified)
EMAIL_PATTERN = re.compile(
    r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
)

# Phone validation pattern (US format)
PHONE_PATTERN = re.compile(
    r'^(\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}$'
)


def validate_email(email: str) -> bool:
    """
    Validate an email address format.

    Args:
        email: The email to validate

    Returns:
        True if valid format
    """
    if not email:
        return False
    return EMAIL_PATTERN.match(email.strip()) is not None


def validate_phone(phone: str) -> bool:
    """
    Validate a US phone number format.

    Args:
        phone: The phone number to validate

    Returns:
        True if valid format
    """
    if not phone:
        return False
    # Remove common formatting characters for validation
    cleaned = re.sub(r'[\s\-\.\(\)]', '', phone)
    return PHONE_PATTERN.match(phone.strip()) is not None


def sanitize_string(text: str, max_length: Optional[int] = None) -> str:
    """
    Sanitize a string for safe storage and display.

    - Strips leading/trailing whitespace
    - Escapes HTML entities
    - Optionally truncates to max length

    Args:
        text: The text to sanitize
        max_length: Optional maximum length

    Returns:
        Sanitized string
    """
    if not text:
        return ""

    # Strip whitespace
    result = text.strip()

    # Escape HTML entities
    result = html.escape(result)

    # Truncate if needed
    if max_length and len(result) > max_length:
        result = result[:max_length]

    return result


def normalize_account_reference(account_ref: str) -> str:
    """
    Normalize an account reference for consistent storage and lookup.

    - Strips whitespace
    - Converts to uppercase
    - Removes common formatting characters

    Args:
        account_ref: The account reference to normalize

    Returns:
        Normalized account reference
    """
    if not account_ref:
        return ""

    result = account_ref.strip().upper()
    # Remove dashes and spaces that might be formatting
    result = re.sub(r'[\s\-]', '', result)

    return result


def is_valid_agency_id(agency_id: str) -> bool:
    """
    Check if agency ID is valid.

    Args:
        agency_id: The agency ID to check

    Returns:
        True if valid
    """
    valid_agencies = ["ICS", "MSB", "VV"]
    return agency_id.upper() in valid_agencies


def validate_required_fields(data: dict, required: list) -> list:
    """
    Validate that required fields are present and non-empty.

    Args:
        data: Dictionary to validate
        required: List of required field names

    Returns:
        List of missing field names
    """
    missing = []
    for field in required:
        if field not in data or not data[field]:
            missing.append(field)
    return missing
