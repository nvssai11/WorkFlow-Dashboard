import requests
from core.config import settings

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
