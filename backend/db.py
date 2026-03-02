"""
SQLite persistence for Azure credentials and created resource data. Reuse per repo by github_login.
"""
import datetime
import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Optional

# DB file next to backend package (project root when running from root)
_db_path: Optional[str] = None


def _get_db_path() -> str:
    global _db_path
    if _db_path is not None:
        return _db_path
    base = Path(__file__).resolve().parent.parent
    path = base / "workflow_dashboard.db"
    _db_path = str(path)
    return _db_path


def _get_connection() -> sqlite3.Connection:
    path = _get_db_path()
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS azure_credentials (
            github_login TEXT PRIMARY KEY,
            credentials_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS deployment_cache (
            github_login TEXT NOT NULL,
            repo_owner TEXT NOT NULL,
            repo_name TEXT NOT NULL,
            resource_group TEXT NOT NULL,
            region TEXT NOT NULL,
            acr_name TEXT NOT NULL,
            aks_name TEXT NOT NULL,
            acr_login_server TEXT NOT NULL,
            acr_username TEXT NOT NULL,
            acr_password TEXT NOT NULL,
            subscription_id TEXT NOT NULL,
            data_json TEXT,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (github_login, repo_owner, repo_name)
        )
        """
    )
    conn.commit()
    return conn


def get_azure_credentials(github_login: str) -> Optional[str]:
    """Load stored Azure credentials JSON for this user. None if not set."""
    conn = _get_connection()
    try:
        row = conn.execute(
            "SELECT credentials_json FROM azure_credentials WHERE github_login = ?",
            (github_login,),
        ).fetchone()
        return row[0] if row else None
    finally:
        conn.close()


def set_azure_credentials(github_login: str, credentials_json: str) -> None:
    """Save Azure credentials for this user. Reused for every repo."""
    conn = _get_connection()
    try:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        conn.execute(
            """
            INSERT INTO azure_credentials (github_login, credentials_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(github_login) DO UPDATE SET
                credentials_json = excluded.credentials_json,
                updated_at = excluded.updated_at
            """,
            (github_login, credentials_json, now),
        )
        conn.commit()
    finally:
        conn.close()


def delete_azure_credentials(github_login: str) -> None:
    """Remove stored Azure credentials for this user."""
    conn = _get_connection()
    try:
        conn.execute("DELETE FROM azure_credentials WHERE github_login = ?", (github_login,))
        conn.commit()
    finally:
        conn.close()


def get_deployment(github_login: str, repo_owner: str, repo_name: str) -> Optional[dict[str, Any]]:
    """Load saved deployment (created resources) for this user and repo. None if never created."""
    conn = _get_connection()
    try:
        row = conn.execute(
            """SELECT resource_group, region, acr_name, aks_name, acr_login_server, acr_username, acr_password, subscription_id, data_json
               FROM deployment_cache WHERE github_login = ? AND repo_owner = ? AND repo_name = ?""",
            (github_login, repo_owner, repo_name),
        ).fetchone()
        if not row:
            return None
        return {
            "resource_group": row[0],
            "region": row[1],
            "acr_name": row[2],
            "aks_name": row[3],
            "acr_login_server": row[4],
            "acr_username": row[5],
            "acr_password": row[6],
            "subscription_id": row[7],
            **(json.loads(row[8]) if row[8] else {}),
        }
    finally:
        conn.close()


def set_deployment(
    github_login: str,
    repo_owner: str,
    repo_name: str,
    resource_group: str,
    region: str,
    acr_name: str,
    aks_name: str,
    acr_login_server: str,
    acr_username: str,
    acr_password: str,
    subscription_id: str,
    extra: Optional[dict[str, Any]] = None,
) -> None:
    """Save created resources for this user and repo. Overwrites if already exists."""
    conn = _get_connection()
    try:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        data_json = json.dumps(extra or {})
        conn.execute(
            """
            INSERT INTO deployment_cache (
                github_login, repo_owner, repo_name, resource_group, region, acr_name, aks_name,
                acr_login_server, acr_username, acr_password, subscription_id, data_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(github_login, repo_owner, repo_name) DO UPDATE SET
                resource_group = excluded.resource_group,
                region = excluded.region,
                acr_name = excluded.acr_name,
                aks_name = excluded.aks_name,
                acr_login_server = excluded.acr_login_server,
                acr_username = excluded.acr_username,
                acr_password = excluded.acr_password,
                subscription_id = excluded.subscription_id,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at
            """,
            (
                github_login, repo_owner, repo_name, resource_group, region, acr_name, aks_name,
                acr_login_server, acr_username, acr_password, subscription_id, data_json, now,
            ),
        )
        conn.commit()
    finally:
        conn.close()
