import yaml
from typing import List


class WorkflowGenerator:
    """Generates GitHub Actions CI workflow YAML from pipeline steps and stack info."""

    def generate_yaml(self, steps: List[str], stack_info: dict) -> str:
        """
        Generates a GitHub Actions workflow YAML string.
        Args:
            steps: Ordered list of step IDs (e.g. ["checkout", "install_deps", "run_tests"])
            stack_info: Dict with language, framework, has_dockerfile, has_test_script
        Returns:
            YAML string
        """
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
                job_steps.append({
                    "name": "Install Dependencies",
                    "run": "pip install -r requirements.txt",
                })
            elif lang == "javascript":
                job_steps.append({
                    "name": "Set up Node",
                    "uses": "actions/setup-node@v4",
                    "with": {"node-version": "18"},
                })
                job_steps.append({
                    "name": "Install Dependencies",
                    "run": "npm install",
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
                if stack_info.get("has_test_script", False):
                    job_steps.append({"name": "Run Tests", "run": "npm test"})
                else:
                    job_steps.append({
                        "name": "Run Tests (optional)",
                        "run": 'if npm run 2>&1 | grep -q "test"; then\n  npm test\nelse\n  echo "No test script found, skipping tests"\nfi',
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

        workflow = {
            "name": "CI Pipeline",
            "on": ["push"],
            "jobs": {
                "build": {
                    "runs-on": "ubuntu-latest",
                    "steps": job_steps,
                }
            },
        }

        return yaml.dump(workflow, sort_keys=False, default_flow_style=False)


workflow_generator = WorkflowGenerator()
