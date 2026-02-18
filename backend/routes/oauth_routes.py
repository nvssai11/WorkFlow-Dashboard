from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from backend.config import settings
from backend.dependencies import get_github_service
from backend.models.schemas import OAuthTokenResponse
from backend.services.github_service import GitHubService

router = APIRouter()

@router.get("/connect")
def github_connect():
    print("CLIENT_ID =", settings.GITHUB_CLIENT_ID)
    print("REDIRECT_URI =", settings.GITHUB_REDIRECT_URI)

    github_oauth_url = (
        "https://github.com/login/oauth/authorize"
        f"?client_id={settings.GITHUB_CLIENT_ID}"
        f"&redirect_uri={settings.GITHUB_REDIRECT_URI}"
        "&scope=repo,workflow"
    )
    return RedirectResponse(github_oauth_url)



@router.get("/callback")
def github_callback(
    code: str,
    github_service: GitHubService = Depends(get_github_service),
):
    token = github_service.exchange_code_for_token(code)
    # Redirect to frontend with token in URL
    frontend_url = f"http://localhost:3000/?access_token={token}"
    return RedirectResponse(frontend_url)
