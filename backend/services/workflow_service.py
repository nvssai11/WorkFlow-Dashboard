from backend.services.github_service import GitHubService


class WorkflowService:
    """Business logic for workflow orchestration"""

    def __init__(self, github_service: GitHubService):
        self.github_service = github_service

    def trigger_workflow(
        self,
        access_token: str,
        owner: str,
        repo: str,
        workflow_id: str,
        branch: str,
    ):
        status, _ = self.github_service.trigger_workflow(
            access_token, owner, repo, workflow_id, branch
        )

        if status != 204:
            return {"success": False, "message": "Failed to trigger workflow"}

        return {"success": True, "message": "Workflow triggered successfully"}
