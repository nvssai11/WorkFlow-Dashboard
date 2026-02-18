import logging


def setup_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            "[%(asctime)s] %(levelname)s - %(message)s"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


def extract_repo_data(repos):
    """
    Extracts essential repository fields for frontend consumption.
    Args:
        repos (list): List of repository dicts from GitHub API.
    Returns:
        list: List of simplified repository dicts.
    """
    return [
        {
            "id": repo["id"],
            "name": repo["name"],
            "full_name": repo["full_name"],
            "owner": {
                "login": repo["owner"]["login"],
                "id": repo["owner"].get("id"),
                "avatar_url": repo["owner"].get("avatar_url"),
                "html_url": repo["owner"].get("html_url"),
                "name": repo["owner"].get("name"),  # Will be None if not present
                "email": repo["owner"].get("email"),  # Will be None if not present
            },
            "html_url": repo["html_url"],
            "description": repo.get("description", ""),
            "language": repo.get("language"),
            "private": repo["private"],
            "fork": repo.get("fork"),
            "clone_url": repo["clone_url"]
        }
        for repo in repos
    ]