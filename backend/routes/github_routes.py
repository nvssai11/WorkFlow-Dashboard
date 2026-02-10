from fastapi import APIRouter, Header
from backend.services.github_service import GitHubService

router = APIRouter()
github_service = GitHubService()

@router.get("/me")
def get_me(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "").strip()
    return github_service.get_user(token)

@router.get("/repos")
def get_repos(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "").strip()
    return github_service.get_simplified_repos(token)