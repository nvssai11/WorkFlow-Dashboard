import yaml
from typing import List


def _ci_steps(steps: List[str], stack_info: dict) -> list:
    """Build the list of CI job steps from requested steps and stack info."""
    job_steps = []

    if "checkout" in steps:
        job_steps.append({"uses": "actions/checkout@v4"})

    if "install_deps" in steps:
        lang = stack_info.get("language", "unknown")
        if lang == "python":
            job_steps.append({
                "name": "Set up Python",
                "uses": "actions/setup-python@v4",
                "with": {"python-version": "3.11"},
            })
            backend_layout = stack_info.get("backend_layout") or "backend/"
            req_file = "requirements.txt" if backend_layout == "root" else "backend/requirements.txt"
            job_steps.append({
                "name": "Install Dependencies",
                "run": f"pip install -r {req_file}",
            })
        elif lang == "javascript":
            job_steps.append({
                "name": "Set up Node",
                "uses": "actions/setup-node@v4",
                "with": {"node-version": "18"},
            })
            frontend_layout = stack_info.get("frontend_layout") or "frontend/"
            install_cmd = "npm install" if frontend_layout == "root" else "cd frontend && npm install"
            job_steps.append({
                "name": "Install Dependencies",
                "run": install_cmd,
            })
        elif lang == "java":
            job_steps.append({
                "name": "Set up Java",
                "uses": "actions/setup-java@v4",
                "with": {"java-version": "17", "distribution": "temurin"},
            })
        elif lang == "go":
            job_steps.append({
                "name": "Set up Go",
                "uses": "actions/setup-go@v5",
                "with": {"go-version": "1.21"},
            })

    if "run_tests" in steps:
        lang = stack_info.get("language", "unknown")
        if lang == "python":
            job_steps.append({"name": "Run Tests", "run": "pytest"})
        elif lang == "javascript":
            frontend_layout = stack_info.get("frontend_layout") or "frontend/"
            test_cmd = "npm test" if frontend_layout == "root" else "cd frontend && npm test"
            if stack_info.get("has_test_script", False):
                job_steps.append({"name": "Run Tests", "run": test_cmd})
            else:
                wrap = test_cmd.replace("\n", " ")
                job_steps.append({
                    "name": "Run Tests (optional)",
                    "run": f'if npm run 2>&1 | grep -q "test"; then {wrap}; else echo "No test script found, skipping tests"; fi' if frontend_layout == "root" else f'if (cd frontend && npm run 2>&1 | grep -q "test"); then {test_cmd}; else echo "No test script found, skipping tests"; fi',
                })
        elif lang == "java":
            job_steps.append({"name": "Run Tests", "run": "mvn test"})
        elif lang == "go":
            job_steps.append({"name": "Run Tests", "run": "go test ./..."})

    if "docker_build" in steps:
        job_steps.append({
            "name": "Build Docker Image",
            "run": "docker build -t my-app .",
        })

    return job_steps


def _cd_steps(stack_info: dict) -> list:
    """Build CD job steps (ACR + AKS) based on repo structure. Only includes backend/frontend steps that exist."""
    has_backend = stack_info.get("has_backend", True)
    has_frontend = stack_info.get("has_frontend", True)
    # If not detected, assume both for backward compatibility
    if not has_backend and not has_frontend:
        has_backend, has_frontend = True, True

    steps = [
        {"uses": "actions/checkout@v4"},
        {"name": "Azure Login", "uses": "azure/login@v2", "with": {"creds": "${{ secrets.AZURE_CREDENTIALS }}"}},
        {
            "name": "Login to ACR",
            "uses": "azure/docker-login@v2",
            "with": {
                "login-server": "${{ secrets.ACR_LOGIN_SERVER }}",
                "username": "${{ secrets.ACR_USERNAME }}",
                "password": "${{ secrets.ACR_PASSWORD }}",
            },
        },
    ]
    if has_backend:
        steps.append({
            "name": "Build and push backend",
            "run": "docker build -f Dockerfile.backend -t ${{ secrets.ACR_LOGIN_SERVER }}/workflow-backend:latest . && docker push ${{ secrets.ACR_LOGIN_SERVER }}/workflow-backend:latest",
        })
    if has_frontend:
        steps.append({
            "name": "Build and push frontend",
            "run": 'API_URL="${{ secrets.BACKEND_PUBLIC_URL }}"; if [ -z "$API_URL" ]; then API_URL="http://localhost:8000"; fi; docker build -f Dockerfile.frontend --build-arg NEXT_PUBLIC_API_URL="$API_URL" -t ${{ secrets.ACR_LOGIN_SERVER }}/workflow-frontend:latest . && docker push ${{ secrets.ACR_LOGIN_SERVER }}/workflow-frontend:latest',
        })
    steps.extend([
        {
            "name": "Install kubectl",
            "run": "curl -sSL \"https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl\" -o kubectl && chmod +x kubectl && sudo mv kubectl /usr/local/bin/",
        },
        {
            "name": "Get AKS credentials",
            "run": "az aks get-credentials --resource-group ${{ secrets.AKS_RESOURCE_GROUP }} --name ${{ secrets.AKS_CLUSTER_NAME }} --overwrite-existing",
        },
    ])
    # Deploy: only apply files that exist; rollout only deployments that exist
    k8s_files = ["k8s/namespace.yaml"]
    if has_backend:
        k8s_files.append("k8s/backend-deployment.yaml")
    if has_frontend:
        k8s_files.append("k8s/frontend-deployment.yaml")
    rollout_parts = []
    if has_backend:
        rollout_parts.append("kubectl rollout status deployment/workflow-backend -n workflow-dashboard --timeout=600s")
    if has_frontend:
        rollout_parts.append("kubectl rollout status deployment/workflow-frontend -n workflow-dashboard --timeout=600s")
    deploy_run = (
        'ACR="${{ secrets.ACR_LOGIN_SERVER }}"; for f in '
        + " ".join(k8s_files)
        + "; do sed \"s|ACR_REGISTRY|${ACR}|g\" \"$f\" | kubectl apply -f -; done; "
        + "; ".join(rollout_parts)
    )
    steps.append({"name": "Deploy to AKS", "run": deploy_run})
    steps.append({"name": "Show services", "run": "kubectl get svc -n workflow-dashboard"})
    steps.append({
        "name": "Print public IP",
        "run": 'echo "Public IP(s) for LoadBalancer service(s):"; kubectl get svc -n workflow-dashboard -o jsonpath=\'{range .items[?(@.spec.type=="LoadBalancer")]}{.metadata.name}: {.status.loadBalancer.ingress[0].ip}{"\\n"}{end}\' 2>/dev/null || echo "Pending or no LoadBalancer services yet."',
    })
    return steps


class WorkflowGenerator:
    """Generates GitHub Actions CI/CD workflow YAML (CI + ACR/AKS CD)."""

    def generate_yaml(self, steps: List[str], stack_info: dict) -> str:
        """
        Generates a single GitHub Actions workflow with CI and CD jobs.
        CI runs first (build/test); CD runs on success (build images, push ACR, deploy AKS).
        """
        ci_steps = _ci_steps(steps, stack_info)

        workflow = {
            "name": "CI/CD Pipeline",
            "on": {
                "push": {"branches": ["main"]},
                "workflow_dispatch": {},
            },
            "concurrency": {
                "group": "cicd-${{ github.ref }}",
                "cancel-in-progress": False,
            },
            "jobs": {
                "ci": {
                    "name": "CI",
                    "runs-on": "ubuntu-latest",
                    "steps": ci_steps,
                },
                "cd": {
                    "name": "CD (ACR + AKS)",
                    "runs-on": "ubuntu-latest",
                    "needs": ["ci"],
                    "steps": _cd_steps(stack_info),
                },
            },
        }

        return yaml.dump(workflow, sort_keys=False, default_flow_style=False, allow_unicode=True)


workflow_generator = WorkflowGenerator()
