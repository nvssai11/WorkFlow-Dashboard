from backend.services.github_service import GitHubService
from backend.services.workflow_service import WorkflowService


def get_github_service() -> GitHubService:
    return GitHubService()


def get_workflow_service() -> WorkflowService:
    github_service = GitHubService()
    return WorkflowService(github_service)
