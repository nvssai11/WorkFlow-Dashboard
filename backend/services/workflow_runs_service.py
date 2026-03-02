import datetime
from typing import Any

from backend.db import (
    list_deployment_repositories,
    list_recent_workflow_runs,
    list_tracked_repositories,
    upsert_tracked_repository,
    upsert_workflow_runs,
)
from backend.services.github_service import GitHubService


class WorkflowRunsService:
    """Synchronize GitHub Actions runs into SQLite and serve dashboard-friendly data."""

    def __init__(self, github_service: GitHubService):
        self.github_service = github_service

    @staticmethod
    def _status_from_github(run: dict[str, Any]) -> str:
        status = (run.get("status") or "").lower()
        conclusion = (run.get("conclusion") or "").lower()
        if status in ("queued", "in_progress"):
            return "queued" if status == "queued" else "running"
        if conclusion == "success":
            return "success"
        if conclusion in ("failure", "cancelled", "timed_out", "stale", "action_required"):
            return "failed"
        return "queued"

    @staticmethod
    def _trigger_from_github(run: dict[str, Any]) -> str:
        event = (run.get("event") or "").lower()
        if event in ("push", "schedule", "workflow_dispatch"):
            return "manual" if event == "workflow_dispatch" else event
        if event == "workflow_run":
            return "retry"
        return "push"

    @staticmethod
    def _duration_seconds(run: dict[str, Any]) -> int:
        started_at = run.get("run_started_at")
        updated_at = run.get("updated_at")
        if not started_at or not updated_at:
            return 0
        try:
            started = datetime.datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            ended = datetime.datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
            return max(0, int((ended - started).total_seconds()))
        except Exception:
            return 0

    def track_repository(self, github_login: str, owner: str, repo: str) -> None:
        upsert_tracked_repository(github_login=github_login, repo_owner=owner, repo_name=repo)

    def refresh_runs_for_user(self, github_login: str, token: str, per_repo_limit: int = 10) -> int:
        tracked = list_tracked_repositories(github_login)
        deployed = list_deployment_repositories(github_login)

        repos_by_key: dict[str, dict[str, str]] = {}
        for item in [*tracked, *deployed]:
            key = f'{item["owner"]}/{item["repo"]}'
            repos_by_key[key] = item
        repos = list(repos_by_key.values())

        if not repos:
            return 0

        all_runs: list[dict[str, Any]] = []
        for item in repos:
            owner, repo = item["owner"], item["repo"]
            try:
                runs = self.github_service.list_workflow_runs(
                    access_token=token,
                    owner=owner,
                    repo=repo,
                    per_page=max(1, min(per_repo_limit, 50)),
                )
            except Exception:
                continue
            for run in runs:
                all_runs.append(
                    {
                        "run_id": int(run.get("id") or 0),
                        "repo_owner": owner,
                        "repo_name": repo,
                        "workflow_name": run.get("name") or "Unnamed Workflow",
                        "trigger": self._trigger_from_github(run),
                        "status": self._status_from_github(run),
                        "branch": run.get("head_branch") or "main",
                        "commit_hash": (run.get("head_sha") or "")[:7],
                        "duration_seconds": self._duration_seconds(run),
                        "run_started_at": run.get("run_started_at") or run.get("created_at") or "",
                        "html_url": run.get("html_url"),
                    }
                )

        valid_runs = [r for r in all_runs if r["run_id"] and r["run_started_at"]]
        upsert_workflow_runs(github_login=github_login, runs=valid_runs)
        return len(valid_runs)

    @staticmethod
    def _format_duration(duration_seconds: int) -> str:
        if duration_seconds <= 0:
            return "-"
        mins, secs = divmod(duration_seconds, 60)
        if mins == 0:
            return f"{secs}s"
        return f"{mins}m {secs}s"

    @staticmethod
    def _relative_time(iso_time: str) -> str:
        try:
            then = datetime.datetime.fromisoformat(iso_time.replace("Z", "+00:00"))
            now = datetime.datetime.now(datetime.timezone.utc)
            diff = max(0, int((now - then).total_seconds()))
        except Exception:
            return iso_time
        if diff < 60:
            return "just now"
        if diff < 3600:
            return f"{diff // 60} mins ago"
        if diff < 86400:
            return f"{diff // 3600} hours ago"
        return f"{diff // 86400} days ago"

    def get_dashboard_runs(self, github_login: str, limit: int = 20) -> dict[str, Any]:
        rows = list_recent_workflow_runs(github_login=github_login, limit=limit)
        runs = [
            {
                "id": str(row["run_id"]),
                "workflowName": row["workflow_name"],
                "trigger": row["trigger"],
                "status": row["status"],
                "duration": self._format_duration(int(row["duration_seconds"] or 0)),
                "timestamp": self._relative_time(row["run_started_at"]),
                "branch": row["branch"],
                "commitHash": row["commit_hash"] or "-",
                "repo": f'{row["repo_owner"]}/{row["repo_name"]}',
                "url": row.get("html_url") or "",
            }
            for row in rows
        ]
        successful = sum(1 for row in rows if row["status"] == "success")
        failed = sum(1 for row in rows if row["status"] == "failed")
        stats = {
            "totalWorkflows": len({f'{row["repo_owner"]}/{row["repo_name"]}' for row in rows}),
            "successfulRuns": successful,
            "failedRuns": failed,
            "imagesPushed": successful,
        }
        return {"stats": stats, "runs": runs}
