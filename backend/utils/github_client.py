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


def get_repo_contents(owner: str, repo: str, token: str, path: str = ""):
    """
    Fetches the contents of a file or directory in a repository.
    Returns a list of items for directories, or a single item dict for files.
    Returns None if not found (404).
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{path}"
    response = requests.get(url, headers=headers)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json()


def create_or_update_file(
    owner: str, repo: str, token: str,
    path: str, message: str, content_b64: str, sha: str = None
):
    """
    Creates or updates a file in a repository via the GitHub Contents API.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{path}"
    data = {"message": message, "content": content_b64}
    if sha:
        data["sha"] = sha
    response = requests.put(url, headers=headers, json=data)
    response.raise_for_status()
    return response.json()