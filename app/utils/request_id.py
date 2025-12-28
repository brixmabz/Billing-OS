"""
Request ID utilities - Generate and parse request IDs.

Request IDs follow the format: REQ-####
Example: REQ-0001, REQ-0042, REQ-1234
"""

import re
from typing import Optional, Tuple

# Pattern for valid request IDs
REQUEST_ID_PATTERN = re.compile(r'^REQ-(\d{4,})$')


def generate_request_id(sequence_number: int) -> str:
    """
    Generate a request ID from a sequence number.

    Args:
        sequence_number: The sequence number (usually from database auto-increment)

    Returns:
        Formatted request ID (e.g., "REQ-0001")
    """
    return f"REQ-{sequence_number:04d}"


def parse_request_id(request_id: str) -> Optional[int]:
    """
    Parse a request ID to extract the sequence number.

    Args:
        request_id: The request ID string (e.g., "REQ-0001")

    Returns:
        The sequence number, or None if invalid format
    """
    match = REQUEST_ID_PATTERN.match(request_id.upper())
    if match:
        return int(match.group(1))
    return None


def is_valid_request_id(request_id: str) -> bool:
    """
    Check if a string is a valid request ID format.

    Args:
        request_id: The string to check

    Returns:
        True if valid format
    """
    return REQUEST_ID_PATTERN.match(request_id.upper()) is not None


def format_request_id(request_id: str) -> str:
    """
    Normalize a request ID to standard format.

    Handles variations like "req-1", "REQ-001", "REQ1"

    Args:
        request_id: The request ID to normalize

    Returns:
        Normalized request ID or original if can't be normalized
    """
    # Try standard format first
    if is_valid_request_id(request_id):
        seq = parse_request_id(request_id)
        return generate_request_id(seq)

    # Try without dash
    no_dash = re.match(r'^REQ(\d+)$', request_id.upper())
    if no_dash:
        return generate_request_id(int(no_dash.group(1)))

    # Try just number
    just_num = re.match(r'^(\d+)$', request_id)
    if just_num:
        return generate_request_id(int(just_num.group(1)))

    return request_id
