import requests
from backend.config import settings
from backend.utils.helpers import extract_repo_data


class GitHubService:
    """Handles all GitHub API interactions"""

    def exchange_code_for_token(self, code: str) -> str:
        url = "https://github.com/login/oauth/access_token"
        headers = {"Accept": "application/json"}
        payload = {
            "client_id": settings.GITHUB_CLIENT_ID,
            "client_secret": settings.GITHUB_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.GITHUB_REDIRECT_URI,
        }

        response = requests.post(url, headers=headers, data=payload)
        response.raise_for_status()

        return response.json().get("access_token")

    def get_user(self, access_token: str):
        """Get authenticated user information"""
        url = "https://api.github.com/user"
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
        }

        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()

    def list_repositories(self, access_token: str):
        """List repositories for authenticated user"""
        url = "https://api.github.com/user/repos"
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
        }

        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return response.json()

    def get_simplified_repos(self, access_token: str):
        """
        Returns simplified repository data for frontend consumption.
        """
        repos = self.list_repositories(access_token)
        return extract_repo_data(repos)

    def trigger_workflow(
        self,
        access_token: str,
        owner: str,
        repo: str,
        workflow_id: str,
        branch: str,
    ):
        url = f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches"
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
        }
        payload = {"ref": branch}

        response = requests.post(url, json=payload, headers=headers)
        return response.status_code, response.text