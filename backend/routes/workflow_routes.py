from fastapi import APIRouter, Depends

from backend.dependencies import get_workflow_service
from backend.models.schemas import (
    TriggerWorkflowRequest,
    WorkflowTriggerResponse,
)
from backend.services.workflow_service import WorkflowService

router = APIRouter()


@router.post("/trigger", response_model=WorkflowTriggerResponse)
def trigger_workflow(
    request: TriggerWorkflowRequest,
    workflow_service: WorkflowService = Depends(get_workflow_service),
):
    result = workflow_service.trigger_workflow(
        access_token=request.access_token,
        owner=request.owner,
        repo=request.repo,
        workflow_id=request.workflow_id,
        branch=request.branch,
    )

    return {
        "status": 200 if result["success"] else 400,
        "message": result["message"],
    }
