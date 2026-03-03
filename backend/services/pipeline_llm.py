"""
Generate GitHub Actions CI/CD workflow YAML using an LLM (Azure OpenAI–compatible API).
Uses repo structure and deployment config to produce a customized pipeline.
"""
import json
import logging
import re
import urllib.request
from typing import Any

from backend.config import settings


def _build_prompt(stack_info: dict, deployment_config: dict) -> str:
    """Build the user prompt for the LLM with repo structure and AKS/ACR details."""
    acr = deployment_config.get("acr_login_server", "") or deployment_config.get("ACR_LOGIN_SERVER", "")
    aks_rg = deployment_config.get("aks_resource_group", "") or deployment_config.get("AKS_RESOURCE_GROUP", "")
    aks_name = deployment_config.get("aks_cluster_name", "") or deployment_config.get("AKS_CLUSTER_NAME", "")
    namespace = deployment_config.get("namespace", "workflow-dashboard")
    has_backend = stack_info.get("has_backend", True)
    has_frontend = stack_info.get("has_frontend", True)
    if not has_backend and not has_frontend:
        has_backend, has_frontend = True, True

    backend_layout = stack_info.get("backend_layout") or "backend/"
    frontend_layout = stack_info.get("frontend_layout") or "frontend/"

    return f"""Generate a single GitHub Actions workflow YAML file.

CRITICAL: Do NOT use "if:" conditions with variables like has_frontend or has_backend. GitHub Actions only supports context (github, secrets, env, vars)—has_frontend and has_backend are NOT available. Instead, include ONLY the jobs and steps that apply to this repo. If the repo has only frontend, emit only frontend build/deploy steps; if only backend, only backend; if both, include both. Never reference has_frontend or has_backend in the YAML.

1. CI job: ubuntu-latest, checkout, install deps, run tests. For JavaScript, prefer lockfile-first install with fallback:
   - repo root: "npm ci || npm install"
   - frontend folder: "cd frontend && (npm ci || npm install)"
   Then run build/tests from the correct layout path.
2. CD job: needs CI, ubuntu-latest; Azure login (secrets.AZURE_CREDENTIALS); ACR login; build and push only the images that exist for this repo; get AKS credentials; apply namespace; create ACR pull secret with: kubectl create secret docker-registry acr-pull-secret --docker-server=${{ secrets.ACR_LOGIN_SERVER }} --docker-username=${{ secrets.ACR_USERNAME }} --docker-password=${{ secrets.ACR_PASSWORD }} -n workflow-dashboard --dry-run=client -o yaml | kubectl apply -f - (the pipe to kubectl apply makes it idempotent—succeeds when secret already exists); deployments must use imagePullSecrets: - name: acr-pull-secret; apply deployment manifests; then a "Diagnose deployment" step: kubectl get pods -n <namespace> -o wide, kubectl describe deployment <each> -n <namespace>, kubectl get events -n <namespace> --sort-by='.lastTimestamp' | tail -40 (logs will show ImagePullBackOff or CrashLoopBackOff cause); then "Wait for rollout" with kubectl rollout status --timeout=600s for each deployment; show services; then a step "Print public IP" that outputs LoadBalancer external IP(s) via kubectl get svc -n <namespace> -o jsonpath.
3. Secrets: AZURE_CREDENTIALS, ACR_LOGIN_SERVER, ACR_USERNAME, ACR_PASSWORD, AKS_RESOURCE_GROUP, AKS_CLUSTER_NAME. Optional: BACKEND_PUBLIC_URL for frontend build-arg.
4. Trigger: push to main, workflow_dispatch. Concurrency: cicd-${{{{ github.ref }}}}.

Repo structure (use this to decide which steps to include—do not put these in the YAML):
- language: {stack_info.get('language', 'unknown')}, framework: {stack_info.get('framework', 'unknown')}
- has_backend: {has_backend}, backend_layout: {backend_layout}
- has_frontend: {has_frontend}, frontend_layout: {frontend_layout}
- detected_files: {stack_info.get('detected_files', [])}
- dependency_file: {stack_info.get('dependency_file')}, has_test_script: {stack_info.get('has_test_script', False)}

Layout rules (Dockerfile.frontend is auto-committed for the repo; workflow only runs docker build):
- When frontend_layout is "root": frontend-only at repo root (no frontend/ folder). Workflow must run "docker build -f Dockerfile.frontend" from repo root with --build-arg NEXT_PUBLIC_API_URL (from secrets.BACKEND_PUBLIC_URL or default). The committed Dockerfile is single-stage (no .next/standalone); do not assume or reference .next/standalone. Build and run use npm ci, npm run build, npm run start.
- When frontend_layout is "frontend/": run "docker build -f Dockerfile.frontend" from repo root; Dockerfile copies frontend/ and uses frontend/ paths.
- When backend_layout is "root": backend code and requirements.txt at repo root.
- When backend_layout is "backend/": backend code in backend/ subfolder.
- Workflow must only run docker build/push and kubectl; do not generate Dockerfile content. Use the committed Dockerfile.frontend and Dockerfile.backend.

Deployment: ACR {acr}, AKS RG {aks_rg}, AKS name {aks_name}, namespace {namespace}. Tag images workflow-backend:latest and/or workflow-frontend:latest.

k8s files that exist (use ONLY these—no other k8s filenames): k8s/namespace.yaml, k8s/backend-deployment.yaml, k8s/frontend-deployment.yaml. There are NO separate service files (no k8s/frontend-service.yaml, no k8s/backend-service.yaml). Each *-deployment.yaml contains both Deployment and Service in one file. Never apply k8s/frontend-service.yaml or k8s/backend-service.yaml or any path that does not exist.

CRITICAL—ACR_REGISTRY placeholder: The committed k8s/*-deployment.yaml files contain the literal string ACR_REGISTRY in the image field (e.g. image: ACR_REGISTRY/workflow-frontend:latest). You MUST replace ACR_REGISTRY with the actual registry URL before applying, or the pod will fail with Invalid ImageName. Use this exact pattern when applying deployment files: ACR="${{{{ secrets.ACR_LOGIN_SERVER }}}}"; for f in k8s/backend-deployment.yaml k8s/frontend-deployment.yaml; do sed "s|ACR_REGISTRY|$ACR|g" "$f" | kubectl apply -f -; done (adjust the list of files to only those that exist for this repo). Never run kubectl apply -f k8s/frontend-deployment.yaml (or backend) without piping through sed to replace ACR_REGISTRY first.

REQUIRED—use ONLY these exact actions (wrong names cause "repository not found"):
- Checkout: uses: actions/checkout@v4
- Azure Login: uses: azure/login@v2 with creds: ${{{{ secrets.AZURE_CREDENTIALS }}}}
- ACR (Docker registry) login: uses: azure/docker-login@v2 with login-server: ${{{{ secrets.ACR_LOGIN_SERVER }}}}, username: ${{{{ secrets.ACR_USERNAME }}}}, password: ${{{{ secrets.ACR_PASSWORD }}}}
Do NOT use azure/acr-login (it does not exist). Do NOT use any other action for login (e.g. docker/login-action) unless you use only the three actions above for this workflow.

Output only the raw YAML content, no markdown fence, no explanation. Start with "name:" and end with the last key. One workflow file with jobs ci and cd."""


def _extract_yaml_from_response(text: str) -> str:
    """Extract YAML from LLM response (strip markdown code blocks if present)."""
    text = text.strip()
    # Remove ```yaml ... ``` or ``` ... ```
    for pattern in [r"^```(?:yaml|yml)\s*\n", r"^```\s*\n", r"\n```\s*$"]:
        text = re.sub(pattern, "", text)
    return text.strip()


def generate_pipeline_yaml(stack_info: dict, deployment_config: dict) -> str:
    """
    Call Azure OpenAI–compatible chat API to generate CI/CD workflow YAML.
    Raises ValueError if API key is missing or API call fails.
    """
    api_key = settings.AZURE_OPENAI_API_KEY or ""
    if not api_key:
        raise ValueError("AZURE_OPENAI_API_KEY is not set. Add it to .env for AI-generated pipelines.")

    url = settings.AZURE_OPENAI_CHAT_URL or "https://dskit-mm7qk81m-eastus2.cognitiveservices.azure.com/openai/v1/chat/completions"
    user_content = _build_prompt(stack_info, deployment_config)

    payload = {
        "messages": [
            {"role": "system", "content": "You are an expert in GitHub Actions and Azure (ACR, AKS). Output only valid workflow YAML. Use ONLY these actions: actions/checkout@v4, azure/login@v2, azure/docker-login@v2. Never use azure/acr-login. When applying k8s deployment YAMLs, always replace ACR_REGISTRY with secrets.ACR_LOGIN_SERVER via sed before kubectl apply (e.g. sed 's|ACR_REGISTRY|$ACR|g' file | kubectl apply -f -), or the image name will be invalid. Use only context: github, secrets, env, vars. No markdown, no code fences, no Dockerfile content."},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": 4000,
        "model": "DeepSeek-V3-0324",
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else str(e)
        logging.error("LLM API HTTP error: %s %s", e.code, body)
        raise ValueError(f"LLM API error: {e.code} - {body[:500]}")
    except Exception as e:
        logging.error("LLM API request failed: %s", e)
        raise ValueError(f"LLM request failed: {str(e)}")

    choices = data.get("choices") or []
    if not choices:
        raise ValueError("LLM returned no choices")
    content = (choices[0].get("message") or {}).get("content") or ""
    if not content:
        raise ValueError("LLM returned empty content")

    yaml_content = _extract_yaml_from_response(content)
    # Fix known wrong action names (e.g. azure/acr-login does not exist -> azure/docker-login)
    yaml_content = _sanitize_generated_workflow(yaml_content)
    return yaml_content


def _sanitize_generated_workflow(yaml_text: str) -> str:
    """Replace invalid action references and wrong k8s paths so the workflow runs."""
    replacements = [
        ("azure/acr-login", "azure/docker-login@v2"),
        ("Azure/acr-login", "azure/docker-login@v2"),
        ("azure/container-registry-login", "azure/docker-login@v2"),
        # No separate service files—Service is inside *-deployment.yaml
        ("k8s/frontend-service.yaml", "k8s/frontend-deployment.yaml"),
        ("k8s/backend-service.yaml", "k8s/backend-deployment.yaml"),
    ]
    for old, new in replacements:
        yaml_text = yaml_text.replace(old, new)
    # Make JS dependency install resilient when lockfile is out of sync.
    yaml_text = re.sub(
        r"cd frontend\s*&&\s*npm ci(?!\s*\|\|)",
        "cd frontend && (npm ci || npm install)",
        yaml_text,
    )
    yaml_text = re.sub(
        r"(?<!\S)npm ci(?!\s*\|\|)",
        "npm ci || npm install",
        yaml_text,
    )
    # Make secret create idempotent: add --dry-run=client -o yaml | kubectl apply -f - when missing
    if "acr-pull-secret" in yaml_text and "--dry-run=client" not in yaml_text:
        lines = yaml_text.split("\n")
        for i, line in enumerate(lines):
            if "acr-pull-secret" in line and "-n workflow-dashboard" in line and "kubectl apply" not in line:
                lines[i] = line.replace(
                    "-n workflow-dashboard",
                    "-n workflow-dashboard --dry-run=client -o yaml | kubectl apply -f -",
                )
                break
        yaml_text = "\n".join(lines)
    return yaml_text
