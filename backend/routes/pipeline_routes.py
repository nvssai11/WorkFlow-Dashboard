from fastapi import APIRouter, Depends, HTTPException
from backend.dependencies import get_current_user_token
from backend.services.analyzer import repo_analyzer
from backend.services.generator import workflow_generator
from backend.models.schemas import (
    PipelineSuggestRequest,
    PipelineGenerateRequest,
    PipelineCommitRequest,
)
from backend.utils.github_client import get_repo_contents, create_or_update_file
import base64

router = APIRouter()


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


@router.post("/commit")
def commit_pipeline(
    request: PipelineCommitRequest,
    token: str = Depends(get_current_user_token),
):
    """Commits the approved YAML to the repository."""
    if request.type not in ("ci", "cd"):
        raise HTTPException(status_code=400, detail="Type must be 'ci' or 'cd'.")

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
