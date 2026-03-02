from pydantic import BaseModel
from typing import Optional, Dict

class OAuthTokenResponse(BaseModel):
    access_token: str

class TriggerWorkflowRequest(BaseModel):
    access_token: str
    owner: str
    repo: str
    workflow_id: str
    branch: str = "main"

class WorkflowTriggerResponse(BaseModel):
    status: int
    message: str


class DashboardStatsResponse(BaseModel):
    totalWorkflows: int
    successfulRuns: int
    failedRuns: int
    imagesPushed: int


class WorkflowRunItem(BaseModel):
    id: str
    workflowName: str
    trigger: str
    status: str
    duration: str
    timestamp: str
    branch: str
    commitHash: str
    repo: Optional[str] = None
    url: Optional[str] = None


class DashboardRunsResponse(BaseModel):
    stats: DashboardStatsResponse
    runs: list[WorkflowRunItem]


class UserSchema(BaseModel):
    id: int
    login: str
    name: Optional[str]
    avatar_url: Optional[str]
    html_url: Optional[str]
    email: Optional[str]

class OwnerSchema(BaseModel):
    login: str
    id: int
    avatar_url: str
    html_url: str
    name: Optional[str] = None
    email: Optional[str] = None

class RepoSchema(BaseModel):
    id: int
    name: str
    full_name: str
    html_url: str
    description: Optional[str]
    language: Optional[str]
    private: bool
    fork: bool
    owner: OwnerSchema
    clone_url: str
    language: Optional[str]
    fork: Optional[bool]
    owner: UserSchema


class PipelineSuggestRequest(BaseModel):
    owner: str
    repo: str


class PipelineGenerateRequest(BaseModel):
    owner: str
    repo: str
    steps: list[str]


class PipelineCommitRequest(BaseModel):
    owner: str
    repo: str
    type: str
    yaml: str


class PipelineSyncSecretsRequest(BaseModel):
    owner: str
    repo: str
    secrets: Dict[str, str]  # secret_name -> plain value


class PipelineGenerateAIRequest(BaseModel):
    owner: str
    repo: str
    deployment_config: Optional[Dict[str, str]] = None  # ACR_LOGIN_SERVER, AKS_RESOURCE_GROUP, AKS_CLUSTER_NAME, etc.


class PipelineSetupRepoRequest(BaseModel):
    owner: str
    repo: str
    secrets: Dict[str, str]  # for GitHub Actions secrets (ACR, AKS, etc.)
    steps: Optional[list[str]] = None  # CI steps; default from suggest if omitted
    use_stored_azure: bool = False  # if True, merge stored AZURE_CREDENTIALS into secrets
    use_ai: bool = False  # if True, generate workflow YAML via LLM instead of template
    use_simple_cd: bool = False  # if True, use minimal CD: single app, inline Dockerfile, secrets ACR_NAME, RESOURCE_GROUP, AKS_CLUSTER
