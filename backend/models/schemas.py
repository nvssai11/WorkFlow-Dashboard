from pydantic import BaseModel

class OAuthTokenResponse(BaseModel):
    access_token: str

class TriggerWorkflowRequest(BaseModel):
    owner: str
    repo: str
    workflow_id: str
    branch: str = "main"

class WorkflowTriggerResponse(BaseModel):
    status: int
    message: str
