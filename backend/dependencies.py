from backend.services.github_service import GitHubService
from backend.services.workflow_service import WorkflowService
from fastapi import Header, HTTPException


def get_github_service() -> GitHubService:
    return GitHubService()


def get_workflow_service() -> WorkflowService:
    github_service = GitHubService()
    return WorkflowService(github_service)


def get_current_user_token(authorization: str = Header(...)) -> str:
    """
    Extracts the Bearer token from the Authorization header.
    Raises HTTPException if header is missing or malformed.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing Authorization header")
    return authorization.replace("Bearer ", "").strip()