from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from backend import db as app_db
from backend.dependencies import get_current_user_token
from backend.services.aks_log_monitor import fetch_error_region, reader
from backend.services.aks_polling_worker import aks_failure_worker
from backend.services.failure_analysis import analyze_failure
from backend.services.github_service import GitHubService

router = APIRouter()


def _get_github_login(token: str) -> str:
    github = GitHubService()
    user = github.get_user(token)
    login = user.get("login") if isinstance(user, dict) else None
    if not login:
        raise HTTPException(status_code=401, detail="Could not get user from token")
    return login


class PollLogsRequest(BaseModel):
    workflow: str = Field(..., min_length=1)
    logs: str = Field(..., min_length=1)
    source: str = "aks"
    pod_name: Optional[str] = None
    before: int = Field(default=6, ge=0, le=100)
    after: int = Field(default=6, ge=0, le=100)
    max_detections: int = Field(default=20, ge=1, le=200)


class ErrorRegionRequest(BaseModel):
    logs: str = Field(..., min_length=1)
    error_line_number: int = Field(..., ge=1)
    before: int = Field(default=6, ge=0, le=100)
    after: int = Field(default=6, ge=0, le=100)


class ResolveFailureRequest(BaseModel):
    resolved: bool = True


@router.get("/monitor/status")
def monitor_status(token: str = Depends(get_current_user_token)):
    _ = token
    return aks_failure_worker.status()


@router.post("/monitor/start")
def monitor_start(token: str = Depends(get_current_user_token)):
    _ = token
    aks_failure_worker.start()
    return aks_failure_worker.status()


@router.post("/monitor/stop")
def monitor_stop(token: str = Depends(get_current_user_token)):
    _ = token
    aks_failure_worker.stop()
    return aks_failure_worker.status()


@router.post("/monitor/poll-once")
def monitor_poll_once(token: str = Depends(get_current_user_token)):
    _ = token
    result = aks_failure_worker.poll_once()
    status = aks_failure_worker.status()
    return {"result": result, "status": status}


@router.get("/monitor/raw-logs")
def monitor_raw_logs(
    limit: int = Query(default=500, ge=1, le=5000),
    token: str = Depends(get_current_user_token),
):
    _ = token
    return {"items": aks_failure_worker.get_raw_logs(limit=limit)}


@router.post("/detect")
def detect_failures(payload: PollLogsRequest):
    lines = payload.logs.splitlines()
    detections = reader(
        lines,
        keywords=None,
        max_detections=payload.max_detections,
    )
    return {"count": len(detections), "detections": detections}


@router.post("/error-region")
def get_error_region(payload: ErrorRegionRequest):
    lines = payload.logs.splitlines()
    try:
        region = fetch_error_region(
            lines,
            payload.error_line_number,
            before=payload.before,
            after=payload.after,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return region


@router.post("/poll")
def poll_and_store_failures(
    payload: PollLogsRequest,
    token: str = Depends(get_current_user_token),
):
    github_login = _get_github_login(token)
    lines = payload.logs.splitlines()
    detections = reader(
        lines,
        keywords=None,
        max_detections=payload.max_detections,
    )

    stored_ids: list[str] = []
    for detection in detections:
        try:
            region = fetch_error_region(
                lines,
                int(detection["line_number"]),
                before=payload.before,
                after=payload.after,
            )
        except ValueError:
            continue
        failure_id = app_db.insert_agent_failure(
            github_login=github_login,
            workflow=payload.workflow,
            source=payload.source,
            pod_name=payload.pod_name,
            timestamp=detection.get("timestamp"),
            error_line_number=int(region["error_line_number"]),
            error_line=str(region["error_line"]),
            matched_keyword=str(detection["matched_keyword"]),
            log_block=str(region["block"]),
        )
        stored_ids.append(failure_id)
        root_cause, fix_suggestion = analyze_failure(
            str(region["error_line"]), str(region["block"])
        )
        if root_cause is not None or fix_suggestion is not None:
            app_db.update_agent_failure_analysis(
                github_login, failure_id, root_cause, fix_suggestion
            )

    return {
        "workflow": payload.workflow,
        "source": payload.source,
        "detected": len(detections),
        "stored": len(stored_ids),
        "failure_ids": stored_ids,
    }


@router.get("/failures")
def list_failures(
    status: Literal["all", "resolved", "unresolved"] = Query(default="all"),
    search: Optional[str] = Query(default=None),
    recent_seconds: int = Query(default=0, ge=0, le=86400),
    limit: int = Query(default=100, ge=1, le=500),
    token: str = Depends(get_current_user_token),
):
    github_login = _get_github_login(token)
    items = app_db.list_agent_failures(
        github_login=github_login,
        status=status,
        search=search,
        recent_seconds=(recent_seconds if recent_seconds > 0 else None),
        limit=limit,
    )
    return {"items": items}


@router.patch("/failures/{failure_id}")
def set_failure_resolved(
    failure_id: str,
    payload: ResolveFailureRequest,
    token: str = Depends(get_current_user_token),
):
    github_login = _get_github_login(token)
    updated = app_db.set_agent_failure_resolved(
        github_login=github_login,
        failure_id=failure_id,
        resolved=payload.resolved,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Failure not found")
    return {"id": failure_id, "resolved": payload.resolved}
