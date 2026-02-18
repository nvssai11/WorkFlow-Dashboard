from pydantic import BaseModel
from typing import Optional

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