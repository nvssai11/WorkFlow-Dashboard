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


def _has_column(conn: sqlite3.Connection, table: str, column: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(row[1] == column for row in rows)


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    if _has_column(conn, table, column):
        return
    conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _ensure_agent_failures_schema(conn: sqlite3.Connection) -> None:
    """
    Backward-compatible migration for older agent_failures schema.
    """
    _ensure_column(conn, "agent_failures", "workflow", "TEXT")
    _ensure_column(conn, "agent_failures", "source", "TEXT DEFAULT 'aks'")
    _ensure_column(conn, "agent_failures", "pod_name", "TEXT")
    _ensure_column(conn, "agent_failures", "timestamp", "TEXT")
    _ensure_column(conn, "agent_failures", "error_line_number", "INTEGER")
    _ensure_column(conn, "agent_failures", "error_line", "TEXT DEFAULT ''")
    _ensure_column(conn, "agent_failures", "matched_keyword", "TEXT DEFAULT ''")
    _ensure_column(conn, "agent_failures", "log_block", "TEXT")
    _ensure_column(conn, "agent_failures", "root_cause", "TEXT")

    conn.execute(
        """
        UPDATE agent_failures
        SET
            workflow = COALESCE(workflow, workflow_name),
            timestamp = COALESCE(timestamp, log_timestamp),
            error_line_number = COALESCE(error_line_number, line_number),
            log_block = COALESCE(log_block, error_block),
            root_cause = COALESCE(root_cause, estimated_root_cause),
            source = COALESCE(source, 'aks'),
            error_line = COALESCE(error_line, ''),
            matched_keyword = COALESCE(matched_keyword, '')
        """
    )


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
        CREATE TABLE IF NOT EXISTS tracked_repositories (
            github_login TEXT NOT NULL,
            repo_owner TEXT NOT NULL,
            repo_name TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (github_login, repo_owner, repo_name)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS workflow_runs (
            github_login TEXT NOT NULL,
            run_id INTEGER NOT NULL,
            repo_owner TEXT NOT NULL,
            repo_name TEXT NOT NULL,
            workflow_name TEXT NOT NULL,
            trigger TEXT NOT NULL,
            status TEXT NOT NULL,
            branch TEXT NOT NULL,
            commit_hash TEXT NOT NULL,
            duration_seconds INTEGER NOT NULL DEFAULT 0,
            run_started_at TEXT NOT NULL,
            html_url TEXT,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (github_login, run_id)
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
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS agent_failures (
            id TEXT PRIMARY KEY,
            github_login TEXT NOT NULL,
            workflow TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'aks',
            pod_name TEXT,
            timestamp TEXT,
            error_line_number INTEGER NOT NULL,
            error_line TEXT NOT NULL,
            matched_keyword TEXT NOT NULL,
            log_block TEXT NOT NULL,
            root_cause TEXT,
            fix_suggestion TEXT,
            urgency TEXT NOT NULL DEFAULT 'moderate',
            resolved INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    _ensure_agent_failures_schema(conn)
    conn.commit()
    return conn


def upsert_tracked_repository(github_login: str, repo_owner: str, repo_name: str) -> None:
    """Track repositories to sync workflow runs efficiently."""
    conn = _get_connection()
    try:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        conn.execute(
            """
            INSERT INTO tracked_repositories (github_login, repo_owner, repo_name, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(github_login, repo_owner, repo_name) DO UPDATE SET
                updated_at = excluded.updated_at
            """,
            (github_login, repo_owner, repo_name, now),
        )
        conn.commit()
    finally:
        conn.close()


def list_tracked_repositories(github_login: str) -> list[dict[str, str]]:
    """Return tracked repositories for a user."""
    conn = _get_connection()
    try:
        rows = conn.execute(
            """
            SELECT repo_owner, repo_name
            FROM tracked_repositories
            WHERE github_login = ?
            ORDER BY updated_at DESC
            """,
            (github_login,),
        ).fetchall()
        return [{"owner": row[0], "repo": row[1]} for row in rows]
    finally:
        conn.close()


def list_deployment_repositories(github_login: str) -> list[dict[str, str]]:
    """Return repos with saved deployment config for a user."""
    conn = _get_connection()
    try:
        rows = conn.execute(
            """
            SELECT repo_owner, repo_name
            FROM deployment_cache
            WHERE github_login = ?
            ORDER BY updated_at DESC
            """,
            (github_login,),
        ).fetchall()
        return [{"owner": row[0], "repo": row[1]} for row in rows]
    finally:
        conn.close()


def upsert_workflow_runs(github_login: str, runs: list[dict[str, Any]]) -> None:
    """Insert or update workflow runs for a user."""
    if not runs:
        return
    conn = _get_connection()
    try:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        conn.executemany(
            """
            INSERT INTO workflow_runs (
                github_login, run_id, repo_owner, repo_name, workflow_name, trigger, status,
                branch, commit_hash, duration_seconds, run_started_at, html_url, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(github_login, run_id) DO UPDATE SET
                repo_owner = excluded.repo_owner,
                repo_name = excluded.repo_name,
                workflow_name = excluded.workflow_name,
                trigger = excluded.trigger,
                status = excluded.status,
                branch = excluded.branch,
                commit_hash = excluded.commit_hash,
                duration_seconds = excluded.duration_seconds,
                run_started_at = excluded.run_started_at,
                html_url = excluded.html_url,
                updated_at = excluded.updated_at
            """,
            [
                (
                    github_login,
                    int(run["run_id"]),
                    run["repo_owner"],
                    run["repo_name"],
                    run["workflow_name"],
                    run["trigger"],
                    run["status"],
                    run["branch"],
                    run["commit_hash"],
                    int(run.get("duration_seconds") or 0),
                    run["run_started_at"],
                    run.get("html_url"),
                    now,
                )
                for run in runs
            ],
        )
        conn.commit()
    finally:
        conn.close()


def list_recent_workflow_runs(github_login: str, limit: int = 20) -> list[dict[str, Any]]:
    """Return latest cached workflow runs for a user."""
    conn = _get_connection()
    try:
        rows = conn.execute(
            """
            SELECT
                run_id, repo_owner, repo_name, workflow_name, trigger, status, branch,
                commit_hash, duration_seconds, run_started_at, html_url
            FROM workflow_runs
            WHERE github_login = ?
            ORDER BY run_started_at DESC
            LIMIT ?
            """,
            (github_login, max(1, min(limit, 200))),
        ).fetchall()
        return [
            {
                "run_id": row[0],
                "repo_owner": row[1],
                "repo_name": row[2],
                "workflow_name": row[3],
                "trigger": row[4],
                "status": row[5],
                "branch": row[6],
                "commit_hash": row[7],
                "duration_seconds": row[8],
                "run_started_at": row[9],
                "html_url": row[10],
            }
            for row in rows
        ]
    finally:
        conn.close()


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


def insert_agent_failure(
    *,
    github_login: str,
    workflow: str,
    source: str,
    pod_name: Optional[str],
    timestamp: Optional[str],
    error_line_number: int,
    error_line: str,
    matched_keyword: str,
    log_block: str,
    root_cause: Optional[str] = None,
    fix_suggestion: Optional[str] = None,
    urgency: str = "moderate",
) -> str:
    conn = _get_connection()
    try:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        failure_id = f"fail_{datetime.datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
        conn.execute(
            """
            INSERT INTO agent_failures (
                id, github_login, workflow, source, pod_name, timestamp, error_line_number,
                error_line, matched_keyword, log_block, root_cause, fix_suggestion, urgency,
                resolved, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            """,
            (
                failure_id,
                github_login,
                workflow,
                source,
                pod_name,
                timestamp,
                error_line_number,
                error_line,
                matched_keyword,
                log_block,
                root_cause,
                fix_suggestion,
                urgency,
                now,
                now,
            ),
        )
        conn.commit()
        return failure_id
    finally:
        conn.close()


def list_agent_failures(
    github_login: str,
    *,
    status: str = "all",
    search: Optional[str] = None,
    recent_seconds: Optional[int] = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    conn = _get_connection()
    try:
        clauses = ["github_login = ?"]
        params: list[Any] = [github_login]

        if status == "resolved":
            clauses.append("resolved = 1")
        elif status == "unresolved":
            clauses.append("resolved = 0")

        if search:
            clauses.append("LOWER(workflow) LIKE ?")
            params.append(f"%{search.lower()}%")

        if recent_seconds is not None and recent_seconds > 0:
            cutoff = (datetime.datetime.utcnow() - datetime.timedelta(seconds=recent_seconds)).isoformat() + "Z"
            clauses.append("COALESCE(timestamp, created_at) >= ?")
            params.append(cutoff)

        params.append(max(1, min(limit, 500)))
        where_sql = " AND ".join(clauses)
        rows = conn.execute(
            f"""
            SELECT
                id, workflow, source, pod_name, timestamp, error_line_number, error_line,
                matched_keyword, log_block, root_cause, fix_suggestion, urgency, resolved,
                created_at, updated_at
            FROM agent_failures
            WHERE {where_sql}
            ORDER BY resolved ASC, COALESCE(timestamp, created_at) DESC
            LIMIT ?
            """,
            tuple(params),
        ).fetchall()

        return [
            {
                "id": row[0],
                "workflow": row[1],
                "source": row[2],
                "podName": row[3],
                "timestamp": row[4],
                "errorLineNumber": row[5],
                "errorLine": row[6],
                "matchedKeyword": row[7],
                "logBlock": row[8],
                "rootCause": row[9],
                "fixSuggestion": row[10],
                "urgency": row[11],
                "resolved": bool(row[12]),
                "createdAt": row[13],
                "updatedAt": row[14],
            }
            for row in rows
        ]
    finally:
        conn.close()


def set_agent_failure_resolved(github_login: str, failure_id: str, resolved: bool) -> bool:
    conn = _get_connection()
    try:
        now = datetime.datetime.utcnow().isoformat() + "Z"
        cursor = conn.execute(
            """
            UPDATE agent_failures
            SET resolved = ?, updated_at = ?
            WHERE github_login = ? AND id = ?
            """,
            (1 if resolved else 0, now, github_login, failure_id),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()
