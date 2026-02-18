import logging
from backend.utils.github_client import get_repo_contents
import base64
import json


class RepoAnalyzer:
    """Analyzes a GitHub repository to detect tech stack and suggest CI steps."""

    def analyze(self, token: str, owner: str, repo: str) -> dict:
        """
        Scans the repository root to infer the tech stack.
        Returns a dict with language, framework, dockerfile, and detected files.
        """
        stack_info = {
            "language": "unknown",
            "framework": "unknown",
            "has_dockerfile": False,
            "dependency_file": None,
            "detected_files": [],
            "has_test_script": False,
        }

        try:
            contents = get_repo_contents(owner, repo, token, "")
        except Exception as e:
            logging.error(f"Error fetching repo contents: {e}")
            return stack_info

        if not contents or not isinstance(contents, list):
            return stack_info

        file_names = [item["name"] for item in contents if item["type"] == "file"]
        stack_info["detected_files"] = file_names

        if "Dockerfile" in file_names:
            stack_info["has_dockerfile"] = True

        if "package.json" in file_names:
            stack_info["language"] = "javascript"
            stack_info["dependency_file"] = "package.json"
            stack_info["framework"] = "node"
            self._check_node_test_script(token, owner, repo, stack_info)

        elif "requirements.txt" in file_names:
            stack_info["language"] = "python"
            stack_info["dependency_file"] = "requirements.txt"
            stack_info["framework"] = "python-generic"

        elif "pom.xml" in file_names:
            stack_info["language"] = "java"
            stack_info["framework"] = "maven"

        elif "go.mod" in file_names:
            stack_info["language"] = "go"
            stack_info["framework"] = "go-module"

        return stack_info

    def _check_node_test_script(self, token: str, owner: str, repo: str, stack_info: dict):
        """Check if package.json has a test script."""
        try:
            pkg_data = get_repo_contents(owner, repo, token, "package.json")
            if pkg_data and "content" in pkg_data:
                content_str = base64.b64decode(pkg_data["content"]).decode("utf-8")
                pkg_json = json.loads(content_str)
                scripts = pkg_json.get("scripts", {})
                if "test" in scripts:
                    stack_info["has_test_script"] = True
        except Exception as e:
            logging.warning(f"Error checking package.json for test script: {e}")


repo_analyzer = RepoAnalyzer()
