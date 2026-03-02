from fastapi import APIRouter, Depends, HTTPException
from backend.dependencies import get_current_user_token
from backend.services.analyzer import repo_analyzer
from backend.services.generator import workflow_generator
from backend.services.templates import (
    DOCKERFILE_BACKEND,
    DOCKERFILE_FRONTEND,
    DOCKERFILE_FRONTEND_ROOT,
    K8S_NAMESPACE,
    K8S_BACKEND_DEPLOYMENT,
    K8S_FRONTEND_DEPLOYMENT,
    SIMPLE_CD_WORKFLOW,
)
from backend.models.schemas import (
    PipelineSuggestRequest,
    PipelineGenerateRequest,
    PipelineGenerateAIRequest,
    PipelineCommitRequest,
    PipelineSyncSecretsRequest,
    PipelineSetupRepoRequest,
)
from backend.utils.github_client import (
    get_repo_contents,
    create_or_update_file,
    get_actions_public_key,
    create_or_update_repo_secret,
    create_commit_with_files,
)
from backend.services.github_service import GitHubService
from backend.services.azure_store import get as get_azure_creds
from backend.services.pipeline_llm import generate_pipeline_yaml as llm_generate_pipeline
from backend.db import upsert_tracked_repository
import base64

router = APIRouter()


def _github_login(token: str) -> str:
    user = GitHubService().get_user(token)
    login = user.get("login") if isinstance(user, dict) else None
    if not login:
        raise HTTPException(status_code=401, detail="Could not get user from token")
    return login


def _track_repo(token: str, owner: str, repo: str) -> None:
    """Best-effort repo tracking for run sync."""
    try:
        login = _github_login(token)
        upsert_tracked_repository(login, owner, repo)
    except Exception:
        pass


@router.post("/suggest")
def suggest_pipeline(
    request: PipelineSuggestRequest,
    token: str = Depends(get_current_user_token),
):
    """Analyzes the repo and returns suggested CI pipeline steps."""
    try:
        stack = repo_analyzer.analyze(token, request.owner, request.repo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    steps = ["checkout", "install_deps", "run_tests"]
    if stack["has_dockerfile"]:
        steps.append("docker_build")

    return {"stack": stack, "suggested_steps": steps}


@router.post("/ci/preview")
def preview_ci_pipeline(
    request: PipelineGenerateRequest,
    token: str = Depends(get_current_user_token),
):
    """Generates CI YAML without committing. Returns YAML for review."""
    try:
        stack = repo_analyzer.analyze(token, request.owner, request.repo)
        yaml_content = workflow_generator.generate_yaml(request.steps, stack)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    return {"yaml": yaml_content}


@router.post("/generate-ai")
def generate_ai_pipeline(
    request: PipelineGenerateAIRequest,
    token: str = Depends(get_current_user_token),
):
    """Generate CI/CD workflow YAML using LLM from repo structure and deployment config."""
    try:
        stack = repo_analyzer.analyze(token, request.owner, request.repo)
        deployment_config = dict(request.deployment_config or {})
        yaml_content = llm_generate_pipeline(stack, deployment_config)
        return {"yaml": yaml_content}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


@router.post("/commit")
def commit_pipeline(
    request: PipelineCommitRequest,
    token: str = Depends(get_current_user_token),
):
    """Commits the approved YAML to the repository."""
    if request.type not in ("ci", "cd"):
        raise HTTPException(status_code=400, detail="Type must be 'ci' or 'cd'.")
    _track_repo(token, request.owner, request.repo)

    file_path = f".github/workflows/{request.type}.yml"
    message = f"Add {request.type.upper()} pipeline (auto-generated)"
    content_b64 = base64.b64encode(request.yaml.encode("utf-8")).decode("utf-8")

    # Check if the file already exists (need SHA for updates)
    existing = get_repo_contents(request.owner, request.repo, token, file_path)
    sha = existing["sha"] if existing and isinstance(existing, dict) else None

    try:
        result = create_or_update_file(
            request.owner, request.repo, token, file_path, message, content_b64, sha
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Commit failed: {str(e)}")

    return {
        "status": "success",
        "message": f"{request.type.upper()} pipeline committed.",
        "file_path": file_path,
        "commit": result.get("commit", {}).get("sha", ""),
    }


@router.post("/sync-secrets")
def sync_secrets_to_repo(
    request: PipelineSyncSecretsRequest,
    token: str = Depends(get_current_user_token),
):
    """Push pipeline secrets from the UI to the repo's GitHub Actions secrets. No manual GitHub Settings needed."""
    if not request.secrets:
        return {"status": "success", "message": "No secrets to sync.", "synced": []}
    _track_repo(token, request.owner, request.repo)
    try:
        pk = get_actions_public_key(request.owner, request.repo, token)
        key_id = pk["key_id"]
        key_b64 = pk["key"]
        synced = []
        for name, value in request.secrets.items():
            if not name or value is None:
                continue
            plain = value if isinstance(value, str) else str(value)
            create_or_update_repo_secret(
                request.owner, request.repo, token, name, plain, key_id, key_b64
            )
            synced.append(name)
        return {"status": "success", "message": f"Synced {len(synced)} secret(s) to repo.", "synced": synced}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync secrets: {str(e)}")


def _commit_file(owner: str, repo: str, token: str, path: str, content: str, message: str):
    content_b64 = base64.b64encode(content.encode("utf-8")).decode("utf-8")
    existing = get_repo_contents(owner, repo, token, path)
    sha = existing["sha"] if existing and isinstance(existing, dict) else None
    return create_or_update_file(owner, repo, token, path, message, content_b64, sha)


@router.post("/setup-repo")
def setup_repo_full_cicd(
    request: PipelineSetupRepoRequest,
    token: str = Depends(get_current_user_token),
):
    """
    One-click: sync secrets to GitHub, then generate and commit Dockerfiles, k8s manifests, and CI/CD workflow.
    User does not need to go to GitHub or Azure Portal to configure anything.
    """
    owner, repo = request.owner, request.repo
    _track_repo(token, owner, repo)
    try:
        # Merge stored Azure credentials if requested
        secrets_to_sync = dict(request.secrets) if request.secrets else {}
        if request.use_stored_azure:
            login = _github_login(token)
            azure_creds = get_azure_creds(login)
            if azure_creds:
                secrets_to_sync["AZURE_CREDENTIALS"] = azure_creds

        # Simple CD path: only sync 4 secrets and commit one workflow file (no analyze, no Dockerfiles/k8s)
        if request.use_simple_cd:
            acr_login = secrets_to_sync.get("ACR_LOGIN_SERVER") or request.secrets.get("ACR_LOGIN_SERVER") or ""
            acr_name = (secrets_to_sync.get("ACR_NAME") or request.secrets.get("ACR_NAME") or
                        acr_login.replace(".azurecr.io", "").strip() if acr_login else "")
            res_group = secrets_to_sync.get("RESOURCE_GROUP") or request.secrets.get("RESOURCE_GROUP") or \
                        secrets_to_sync.get("AKS_RESOURCE_GROUP") or request.secrets.get("AKS_RESOURCE_GROUP") or ""
            aks_cluster = secrets_to_sync.get("AKS_CLUSTER") or request.secrets.get("AKS_CLUSTER") or \
                          secrets_to_sync.get("AKS_CLUSTER_NAME") or request.secrets.get("AKS_CLUSTER_NAME") or ""
            simple_secrets = {}
            if secrets_to_sync.get("AZURE_CREDENTIALS"):
                simple_secrets["AZURE_CREDENTIALS"] = secrets_to_sync["AZURE_CREDENTIALS"]
            if acr_name:
                simple_secrets["ACR_NAME"] = acr_name
            if res_group:
                simple_secrets["RESOURCE_GROUP"] = res_group
            if aks_cluster:
                simple_secrets["AKS_CLUSTER"] = aks_cluster
            if simple_secrets:
                pk = get_actions_public_key(owner, repo, token)
                for name, value in simple_secrets.items():
                    if value:
                        create_or_update_repo_secret(owner, repo, token, name, str(value), pk["key_id"], pk["key"])
            create_commit_with_files(
                owner, repo, token,
                "Add simple AKS CD pipeline",
                [(".github/workflows/cd.yml", SIMPLE_CD_WORKFLOW)],
                deletes=[".github/workflows/ci.yml"],
            )
            return {
                "status": "success",
                "message": "Simple CD pipeline added. Secrets synced: AZURE_CREDENTIALS, ACR_NAME, RESOURCE_GROUP, AKS_CLUSTER.",
                "synced_secrets": list(simple_secrets.keys()),
            }

        # 1) Sync secrets first so they exist when the workflow runs
        if secrets_to_sync:
            pk = get_actions_public_key(owner, repo, token)
            for name, value in secrets_to_sync.items():
                if not name or value is None:
                    continue
                plain = value if isinstance(value, str) else str(value)
                create_or_update_repo_secret(
                    owner, repo, token, name, plain, pk["key_id"], pk["key"]
                )

        # 2) Always analyze repo first; use result to decide what to commit
        stack = repo_analyzer.analyze(token, owner, repo)
        has_backend = stack.get("has_backend", True)
        has_frontend = stack.get("has_frontend", True)
        if not has_backend and not has_frontend:
            has_backend, has_frontend = True, True

        steps = list(request.steps) if request.steps else ["checkout", "install_deps", "run_tests"]
        if stack.get("has_dockerfile") and "docker_build" not in steps:
            steps = steps + ["docker_build"]

        # 3) Generate workflow YAML (AI or template)
        if request.use_ai:
            deployment_config = {
                "acr_login_server": secrets_to_sync.get("ACR_LOGIN_SERVER") or request.secrets.get("ACR_LOGIN_SERVER"),
                "aks_resource_group": secrets_to_sync.get("AKS_RESOURCE_GROUP") or request.secrets.get("AKS_RESOURCE_GROUP"),
                "aks_cluster_name": secrets_to_sync.get("AKS_CLUSTER_NAME") or request.secrets.get("AKS_CLUSTER_NAME"),
                "namespace": "workflow-dashboard",
            }
            try:
                yaml_content = llm_generate_pipeline(stack, deployment_config)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
        else:
            yaml_content = workflow_generator.generate_yaml(steps, stack)

        # 4) Single commit: Dockerfiles, k8s manifests, and CI/CD workflow (one run)
        files = []
        frontend_layout = stack.get("frontend_layout") or "frontend/"
        backend_layout = stack.get("backend_layout") or "backend/"
        if has_backend:
            files.append(("Dockerfile.backend", DOCKERFILE_BACKEND))
        if has_frontend:
            dockerfile_frontend = DOCKERFILE_FRONTEND_ROOT if frontend_layout == "root" else DOCKERFILE_FRONTEND
            files.append(("Dockerfile.frontend", dockerfile_frontend))
        files.append(("k8s/namespace.yaml", K8S_NAMESPACE))
        if has_backend:
            files.append(("k8s/backend-deployment.yaml", K8S_BACKEND_DEPLOYMENT))
        if has_frontend:
            files.append(("k8s/frontend-deployment.yaml", K8S_FRONTEND_DEPLOYMENT))
        files.append((".github/workflows/ci.yml", yaml_content))
        create_commit_with_files(
            owner, repo, token,
            "Enable CI/CD: add workflow, Dockerfiles, and k8s manifests",
            files,
            deletes=[".github/workflows/cd.yml"],
        )

        return {
            "status": "success",
            "message": "Repo fully configured: secrets synced, Dockerfiles and k8s added, CI/CD workflow committed.",
            "synced_secrets": list(secrets_to_sync.keys()),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Setup failed: {str(e)}")
