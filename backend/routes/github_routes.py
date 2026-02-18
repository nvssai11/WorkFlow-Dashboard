from fastapi import APIRouter, Depends, HTTPException, Query
from backend.services.github_service import GitHubService
from backend.dependencies import get_current_user_token
from backend.models.schemas import UserSchema, RepoSchema

router = APIRouter()
github_service = GitHubService()

@router.get("/me", response_model=UserSchema)
def get_me(token: str = Depends(get_current_user_token)):
    """Returns authenticated user information."""
    try:
        return github_service.get_user(token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/repos", response_model=list[RepoSchema])
def get_repos(token: str = Depends(get_current_user_token)):
    """
    Returns simplified repository data for the authenticated user.
    """
    try:
        return github_service.get_simplified_repos(token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/repo-languages")
def get_repo_languages_route(
    owner: str = Query(...),
    repo: str = Query(...),
    token: str = Depends(get_current_user_token)
):
    """
    Returns the programming languages for a specific repository.
    """
    try:
        return github_service.get_repo_languages(owner, repo, token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))