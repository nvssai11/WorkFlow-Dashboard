from fastapi import APIRouter, Depends, Query

from backend.dependencies import (
    get_workflow_service,
    get_current_user_token,
    get_workflow_runs_service,
)
from backend.models.schemas import (
    TriggerWorkflowRequest,
    WorkflowTriggerResponse,
    DashboardRunsResponse,
)
from backend.services.workflow_service import WorkflowService
from backend.services.workflow_runs_service import WorkflowRunsService

router = APIRouter()


@router.post("/trigger", response_model=WorkflowTriggerResponse)
def trigger_workflow(
    request: TriggerWorkflowRequest,
    token: str = Depends(get_current_user_token),
    workflow_service: WorkflowService = Depends(get_workflow_service),
    workflow_runs_service: WorkflowRunsService = Depends(get_workflow_runs_service),
):
    user = workflow_runs_service.github_service.get_user(token)
    login = user.get("login") if isinstance(user, dict) else ""
    if login:
        workflow_runs_service.track_repository(login, request.owner, request.repo)

    result = workflow_service.trigger_workflow(
        access_token=token,
        owner=request.owner,
        repo=request.repo,
        workflow_id=request.workflow_id,
        branch=request.branch,
    )

    return {
        "status": 200 if result["success"] else 400,
        "message": result["message"],
    }


@router.get("/runs", response_model=DashboardRunsResponse)
def get_recent_workflow_runs(
    token: str = Depends(get_current_user_token),
    workflow_runs_service: WorkflowRunsService = Depends(get_workflow_runs_service),
    limit: int = Query(default=20, ge=1, le=100),
    refresh: bool = Query(default=True),
):
    user = workflow_runs_service.github_service.get_user(token)
    login = user.get("login") if isinstance(user, dict) else None
    if not login:
        return {"stats": {"totalWorkflows": 0, "successfulRuns": 0, "failedRuns": 0, "imagesPushed": 0}, "runs": []}

    if refresh:
        workflow_runs_service.refresh_runs_for_user(login, token)

    return workflow_runs_service.get_dashboard_runs(login, limit=limit)
