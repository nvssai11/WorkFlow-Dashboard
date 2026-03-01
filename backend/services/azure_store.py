"""
Azure credentials store backed by SQLite. Persists across restarts; reused for every repo per user.
"""
from typing import Optional

from backend import db as _db


def get(github_login: str) -> Optional[str]:
    """Get stored Azure credentials JSON for user. Returns None if not set."""
    return _db.get_azure_credentials(github_login)


def set_(github_login: str, credentials_json: str) -> None:
    """Store Azure credentials JSON for user. Cached in DB; reused for all repos."""
    _db.set_azure_credentials(github_login, credentials_json)


def delete(github_login: str) -> None:
    """Remove stored credentials for user."""
    _db.delete_azure_credentials(github_login)


def is_connected(github_login: str) -> bool:
    creds = get(github_login)
    return bool(creds and creds.strip())
