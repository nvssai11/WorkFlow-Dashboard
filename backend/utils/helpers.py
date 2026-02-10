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
            "owner": repo["owner"]["login"],
            "html_url": repo["html_url"],
            "description": repo.get("description", ""),
            "private": repo["private"],
            "clone_url": repo["clone_url"]
        }
        for repo in repos
    ]