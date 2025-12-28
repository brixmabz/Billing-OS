"""
File Storage - Handles file uploads and storage.

Supports multiple storage backends:
- Local filesystem (development)
- Supabase Storage (production)
- S3-compatible storage (future)
"""

import os
import uuid
import shutil
from pathlib import Path
from typing import Optional, Dict, Any, BinaryIO
from datetime import datetime

from app.core.config import settings


class FileStorage:
    """
    File storage service with pluggable backends.
    """

    # Allowed file types for uploads
    ALLOWED_EXTENSIONS = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }

    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize file storage.

        Args:
            storage_path: Path for local storage (default: ./uploads)
        """
        self.storage_path = Path(storage_path or "./uploads")
        self.storage_path.mkdir(parents=True, exist_ok=True)

    def _generate_filename(self, original_filename: str) -> str:
        """Generate unique filename while preserving extension."""
        ext = Path(original_filename).suffix.lower()
        unique_id = uuid.uuid4().hex[:12]
        timestamp = datetime.utcnow().strftime("%Y%m%d")
        return f"{timestamp}_{unique_id}{ext}"

    def _get_extension(self, filename: str) -> str:
        """Get file extension without dot."""
        return Path(filename).suffix.lower().lstrip('.')

    def is_allowed_file(self, filename: str) -> bool:
        """Check if file type is allowed."""
        ext = self._get_extension(filename)
        return ext in self.ALLOWED_EXTENSIONS

    def get_mime_type(self, filename: str) -> str:
        """Get MIME type for filename."""
        ext = self._get_extension(filename)
        return self.ALLOWED_EXTENSIONS.get(ext, 'application/octet-stream')

    async def save_file(
        self,
        file_content: bytes | BinaryIO,
        original_filename: str,
        request_id: str,
        uploaded_by: Optional[int] = None,
        is_client_upload: bool = False
    ) -> Dict[str, Any]:
        """
        Save a file to storage.

        Args:
            file_content: File content (bytes or file-like object)
            original_filename: Original filename
            request_id: Associated request ID
            uploaded_by: User ID who uploaded (None for client uploads)
            is_client_upload: Whether uploaded via client portal

        Returns:
            File metadata including storage path
        """
        # Validate file type
        if not self.is_allowed_file(original_filename):
            raise ValueError(f"File type not allowed: {original_filename}")

        # Generate unique filename
        stored_filename = self._generate_filename(original_filename)

        # Create request-specific directory
        request_dir = self.storage_path / request_id
        request_dir.mkdir(parents=True, exist_ok=True)

        # Full path for storage
        file_path = request_dir / stored_filename

        # Write file
        if isinstance(file_content, bytes):
            file_path.write_bytes(file_content)
            file_size = len(file_content)
        else:
            # File-like object
            with open(file_path, 'wb') as f:
                shutil.copyfileobj(file_content, f)
            file_size = file_path.stat().st_size

        # Check file size
        if file_size > self.MAX_FILE_SIZE:
            file_path.unlink()  # Delete the file
            raise ValueError(f"File too large: {file_size} bytes (max {self.MAX_FILE_SIZE})")

        return {
            "filename": stored_filename,
            "original_filename": original_filename,
            "storage_path": str(file_path),
            "storage_provider": "local",
            "mime_type": self.get_mime_type(original_filename),
            "size": file_size,
            "request_id": request_id,
            "uploaded_by": uploaded_by,
            "uploaded_by_client": is_client_upload,
            "created_at": datetime.utcnow().isoformat(),
        }

    async def get_file(self, storage_path: str) -> Optional[bytes]:
        """
        Retrieve a file from storage.

        Args:
            storage_path: Path to the stored file

        Returns:
            File content as bytes, or None if not found
        """
        path = Path(storage_path)
        if path.exists():
            return path.read_bytes()
        return None

    async def delete_file(self, storage_path: str) -> bool:
        """
        Delete a file from storage.

        Args:
            storage_path: Path to the stored file

        Returns:
            True if deleted, False if not found
        """
        path = Path(storage_path)
        if path.exists():
            path.unlink()
            return True
        return False

    async def list_files(self, request_id: str) -> list:
        """
        List all files for a request.

        Args:
            request_id: The request ID

        Returns:
            List of file info dictionaries
        """
        request_dir = self.storage_path / request_id
        if not request_dir.exists():
            return []

        files = []
        for file_path in request_dir.iterdir():
            if file_path.is_file():
                files.append({
                    "filename": file_path.name,
                    "storage_path": str(file_path),
                    "size": file_path.stat().st_size,
                    "modified_at": datetime.fromtimestamp(
                        file_path.stat().st_mtime
                    ).isoformat(),
                })

        return files

    async def get_storage_stats(self) -> Dict[str, Any]:
        """
        Get storage statistics.

        Returns:
            Dictionary with storage stats
        """
        total_size = 0
        file_count = 0
        request_count = 0

        for request_dir in self.storage_path.iterdir():
            if request_dir.is_dir():
                request_count += 1
                for file_path in request_dir.iterdir():
                    if file_path.is_file():
                        file_count += 1
                        total_size += file_path.stat().st_size

        return {
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "file_count": file_count,
            "request_count": request_count,
            "storage_path": str(self.storage_path),
        }


# Singleton instance
_file_storage: Optional[FileStorage] = None


def get_file_storage() -> FileStorage:
    """Get or create file storage instance."""
    global _file_storage
    if _file_storage is None:
        _file_storage = FileStorage()
    return _file_storage
