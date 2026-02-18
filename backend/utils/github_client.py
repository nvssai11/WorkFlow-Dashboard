import requests
from backend.config import settings

def github_request(method: str, endpoint: str, token: str, json=None):
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json"
    }

    response = requests.request(
        method=method,
        url=f"{settings.GITHUB_API_BASE}{endpoint}",
        headers=headers,
        json=json
    )

    response.raise_for_status()
    return response.json()


def get_repo_languages(owner: str, repo: str, token: str):
    """
    Fetches the programming languages used in a repository.
    Returns a dict of languages and their byte counts.
    """
    endpoint = f"/repos/{owner}/{repo}/languages"
    return github_request("GET", endpoint, token)