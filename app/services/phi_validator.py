"""
PHI Validator Service - Detects and blocks Protected Health Information in free-text fields.

Per HIPAA requirements, PHI must not be transmitted via email or stored in uncontrolled fields.
This service scans text for common PHI patterns and blocks submission if detected.
"""

import re
from typing import Tuple, List
from dataclasses import dataclass


@dataclass
class PHIViolation:
    """Represents a detected PHI violation."""
    type: str
    description: str
    pattern_matched: str


class PHIValidator:
    """
    Validates text for PHI patterns.

    Detects:
    - Social Security Numbers (SSN)
    - Dates of Birth (DOB)
    - Common name patterns
    - PHI-related keywords
    - Medical Record Numbers (MRN)
    - Health plan beneficiary numbers
    """

    # Pattern definitions with descriptions
    PATTERNS = [
        # SSN patterns
        {
            "pattern": r'\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b',
            "type": "SSN",
            "description": "Social Security Number detected"
        },
        {
            "pattern": r'\b\d{9}\b',
            "type": "SSN_NO_DELIM",
            "description": "9-digit number (possible SSN without delimiters)"
        },

        # Date of Birth patterns
        {
            "pattern": r'\b(dob|date of birth|birth\s*date|d\.o\.b\.?)\s*[:\-]?\s*\d',
            "type": "DOB_KEYWORD",
            "description": "Date of Birth with keyword"
        },
        {
            "pattern": r'\bborn\s+(on\s+)?\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b',
            "type": "DOB_PHRASE",
            "description": "Birth date phrase detected"
        },

        # PHI Keywords
        {
            "pattern": r'\b(social\s*security|ssn|ss#|ss\s*#)\b',
            "type": "SSN_KEYWORD",
            "description": "Social Security keyword detected"
        },
        {
            "pattern": r'\b(diagnosis|diagnosed|condition|symptom|treatment|medication|prescription)\b',
            "type": "MEDICAL_KEYWORD",
            "description": "Medical information keyword detected"
        },

        # Medical Record Numbers
        {
            "pattern": r'\b(mrn|medical\s*record|patient\s*id|chart\s*#?)\s*[:\-#]?\s*[a-z0-9]+\b',
            "type": "MRN",
            "description": "Medical Record Number detected"
        },

        # Health Insurance IDs with values
        {
            "pattern": r'\b(member\s*id|policy\s*#?|subscriber\s*id|group\s*#?)\s*[:\-]?\s*[a-z0-9]{6,}\b',
            "type": "INSURANCE_ID",
            "description": "Insurance ID with value detected"
        },

        # Full names with common patterns (first last)
        {
            "pattern": r'\bpatient\s*name\s*[:\-]?\s*[a-z]+\s+[a-z]+\b',
            "type": "PATIENT_NAME",
            "description": "Patient name detected"
        },

        # Email addresses (can identify individuals)
        {
            "pattern": r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b',
            "type": "EMAIL",
            "description": "Email address detected (can identify individual)"
        },

        # Phone numbers
        {
            "pattern": r'\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b',
            "type": "PHONE",
            "description": "Phone number detected"
        },
    ]

    # Patterns that are warnings but not blockers
    WARNING_PATTERNS = [
        {
            "pattern": r'\b(insurance|coverage|claim|payer|carrier)\b',
            "type": "INSURANCE_KEYWORD",
            "description": "Insurance-related keyword (review for PHI context)"
        },
    ]

    def __init__(self, strict_mode: bool = True):
        """
        Initialize validator.

        Args:
            strict_mode: If True, blocks on any PHI detection.
                        If False, only blocks on high-confidence patterns.
        """
        self.strict_mode = strict_mode
        self._compile_patterns()

    def _compile_patterns(self):
        """Pre-compile regex patterns for performance."""
        self.compiled_patterns = [
            {
                "regex": re.compile(p["pattern"], re.IGNORECASE),
                "type": p["type"],
                "description": p["description"]
            }
            for p in self.PATTERNS
        ]

        self.compiled_warnings = [
            {
                "regex": re.compile(p["pattern"], re.IGNORECASE),
                "type": p["type"],
                "description": p["description"]
            }
            for p in self.WARNING_PATTERNS
        ]

    def validate(self, text: str) -> Tuple[bool, List[PHIViolation]]:
        """
        Validate text for PHI patterns.

        Args:
            text: The text to validate

        Returns:
            Tuple of (is_clean, violations)
            - is_clean: True if no PHI detected
            - violations: List of PHIViolation objects describing what was found
        """
        if not text:
            return True, []

        violations = []

        for pattern_info in self.compiled_patterns:
            match = pattern_info["regex"].search(text)
            if match:
                violations.append(PHIViolation(
                    type=pattern_info["type"],
                    description=pattern_info["description"],
                    pattern_matched=match.group()[:20] + "..." if len(match.group()) > 20 else match.group()
                ))

        return len(violations) == 0, violations

    def get_warnings(self, text: str) -> List[PHIViolation]:
        """
        Get warnings (non-blocking) for text.

        Args:
            text: The text to check

        Returns:
            List of warning violations
        """
        if not text:
            return []

        warnings = []

        for pattern_info in self.compiled_warnings:
            match = pattern_info["regex"].search(text)
            if match:
                warnings.append(PHIViolation(
                    type=pattern_info["type"],
                    description=pattern_info["description"],
                    pattern_matched=match.group()
                ))

        return warnings

    def sanitize(self, text: str) -> str:
        """
        Attempt to sanitize text by redacting PHI patterns.

        Note: This is a best-effort sanitization. It's always better
        to reject PHI-containing text than to rely on sanitization.

        Args:
            text: The text to sanitize

        Returns:
            Text with PHI patterns redacted
        """
        if not text:
            return text

        result = text

        for pattern_info in self.compiled_patterns:
            result = pattern_info["regex"].sub("[REDACTED]", result)

        return result


# Singleton instance for convenience
_validator = None


def get_phi_validator(strict_mode: bool = True) -> PHIValidator:
    """Get or create PHI validator instance."""
    global _validator
    if _validator is None:
        _validator = PHIValidator(strict_mode=strict_mode)
    return _validator


def validate_text_for_phi(text: str) -> Tuple[bool, List[str]]:
    """
    Convenience function to validate text.

    Args:
        text: Text to validate

    Returns:
        Tuple of (is_clean, list of violation type strings)
    """
    validator = get_phi_validator()
    is_clean, violations = validator.validate(text)
    return is_clean, [v.type for v in violations]
