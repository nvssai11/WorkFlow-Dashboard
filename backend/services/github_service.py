import requests
import logging
from backend.config import settings
from backend.utils.helpers import extract_repo_data
from backend.utils.github_client import get_repo_languages

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
        try:
            response = requests.post(url, headers=headers, data=payload)
            response.raise_for_status()
            return response.json().get("access_token")
        except requests.exceptions.RequestException as e:
            logging.error(f"Error exchanging code for token: {e}")
            raise

    def get_user(self, access_token: str):
        """Get authenticated user information"""
        url = f"{settings.GITHUB_API_BASE}/user"
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
        }
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.error(f"Error fetching user info: {e}")
            raise

    def list_repositories(self, access_token: str):
        """List repositories for authenticated user"""
        url = f"{settings.GITHUB_API_BASE}/user/repos"
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
        }
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.error(f"Error listing repositories: {e}")
            raise

    def get_repository(self, access_token: str, repo_id: int):
        """Get a single repository by ID"""
        url = f"https://api.github.com/repositories/{repo_id}"
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
        }
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.error(f"Error fetching repository {repo_id}: {e}")
            raise

    def get_simplified_repos(self, access_token: str):
        """
        Returns simplified repository data for frontend consumption.
        """
        repos = self.list_repositories(access_token)
        return extract_repo_data(repos)

    def get_simplified_repo(self, repo_id: int, access_token: str):
        """
        Returns simplified repository data for a single repository.
        """
        repo = self.get_repository(access_token, repo_id)
        # extract_repo_data expects a list, so we wrap the single repo in a list
        # and then return the first element
        return extract_repo_data([repo])[0]

    def get_repo_languages(self, owner: str, repo: str, token: str):
        """
        Returns the programming languages for a specific repository.
        """
        if not owner or not repo or not token:
            logging.error("Missing owner, repo, or token for language retrieval.")
            raise ValueError("Owner, repo, and token must be provided.")
        try:
            return get_repo_languages(owner, repo, token)
        except Exception as e:
            logging.error(f"Error fetching repo languages: {e}")
            raise

    def trigger_workflow(
        self,
        access_token: str,
        owner: str,
        repo: str,
        workflow_id: str,
        branch: str,
    ):
        url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches"
        headers = {
            "Authorization": f"token {access_token}",
            "Accept": "application/vnd.github.v3+json",
        }
        payload = {"ref": branch}
        try:
            response = requests.post(url, json=payload, headers=headers)
            response.raise_for_status()
            return response.status_code, response.text
        except requests.exceptions.RequestException as e:
            logging.error(f"Error triggering workflow: {e}")
            raise