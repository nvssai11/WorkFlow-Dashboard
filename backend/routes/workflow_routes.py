from fastapi import APIRouter, Depends

from backend.dependencies import get_workflow_service, get_current_user_token
from backend.models.schemas import (
    TriggerWorkflowRequest,
    WorkflowTriggerResponse,
)
from backend.services.workflow_service import WorkflowService

router = APIRouter()


@router.post("/trigger", response_model=WorkflowTriggerResponse)
def trigger_workflow(
    request: TriggerWorkflowRequest,
    token: str = Depends(get_current_user_token),
    workflow_service: WorkflowService = Depends(get_workflow_service),
):
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