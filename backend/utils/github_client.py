import base64
import requests
from backend.config import settings

try:
    from nacl import encoding, public
    HAS_PYNACL = True
except ImportError:
    HAS_PYNACL = False


def github_request(method: str, endpoint: str, token: str, json=None):
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json"
    }

    response = requests.request(
        method=method,
        url=f"{settings.GITHUB_API_BASE}{endpoint}",
        headers=headers,
        json=json
    )

    response.raise_for_status()
    return response.json()


def get_repo_languages(owner: str, repo: str, token: str):
    """
    Fetches the programming languages used in a repository.
    Returns a dict of languages and their byte counts.
    """
    endpoint = f"/repos/{owner}/{repo}/languages"
    return github_request("GET", endpoint, token)


def get_repo_contents(owner: str, repo: str, token: str, path: str = ""):
    """
    Fetches the contents of a file or directory in a repository.
    Returns a list of items for directories, or a single item dict for files.
    Returns None if not found (404).
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{path}"
    response = requests.get(url, headers=headers)
    if response.status_code == 404:
        return None
    response.raise_for_status()
    return response.json()


def create_or_update_file(
    owner: str, repo: str, token: str,
    path: str, message: str, content_b64: str, sha: str = None
):
    """
    Creates or updates a file in a repository via the GitHub Contents API.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{path}"
    data = {"message": message, "content": content_b64}
    if sha:
        data["sha"] = sha
    response = requests.put(url, headers=headers, json=data)
    response.raise_for_status()
    return response.json()


def get_actions_public_key(owner: str, repo: str, token: str) -> dict:
    """Get the public key for encrypting GitHub Actions secrets. Returns {key_id, key}."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/actions/secrets/public-key"
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    return response.json()


def encrypt_secret_for_github(public_key_b64: str, plain_value: str) -> str:
    """Encrypt a secret value using the repo's public key (libsodium sealed box)."""
    if not HAS_PYNACL:
        raise RuntimeError("PyNaCl is required for GitHub Actions secrets. Install with: pip install PyNaCl")
    pub = public.PublicKey(public_key_b64.encode("utf-8"), encoding.Base64Encoder())
    sealed = public.SealedBox(pub)
    encrypted = sealed.encrypt(plain_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")


def create_or_update_repo_secret(
    owner: str, repo: str, token: str, secret_name: str, plain_value: str, key_id: str, public_key_b64: str
) -> None:
    """Create or update a repository Actions secret. Encrypts value with repo public key."""
    encrypted = encrypt_secret_for_github(public_key_b64, plain_value)
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    url = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}/actions/secrets/{secret_name}"
    response = requests.put(url, headers=headers, json={"encrypted_value": encrypted, "key_id": key_id})
    response.raise_for_status()


def create_commit_with_files(
    owner: str,
    repo: str,
    token: str,
    message: str,
    files: list[tuple[str, str]],
    branch: str = "main",
    deletes: list[str] | None = None,
) -> dict:
    """
    Create a single commit that adds/updates multiple files and optionally deletes others (Git Data API).
    files: list of (path, content) with UTF-8 text content.
    deletes: optional list of paths to remove (only existing paths are deleted).
    Returns the commit info dict from GitHub.
    """
    if not files and not deletes:
        raise ValueError("files and deletes must not both be empty")

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }
    base = f"{settings.GITHUB_API_BASE}/repos/{owner}/{repo}"

    # Resolve branch ref (try main then master)
    commit_sha = None
    for b in [branch, "main", "master"]:
        url = f"{base}/git/ref/heads/{b}"
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            data = r.json()
            commit_sha = data["object"]["sha"]
            branch = b
            break
    if commit_sha is None:
        raise RuntimeError("Could not find branch main or master")

    # Get current commit to use its tree as base and as parent
    r = requests.get(f"{base}/git/commits/{commit_sha}", headers=headers)
    r.raise_for_status()
    base_tree_sha = r.json()["tree"]["sha"]

    tree_entries = []

    # Add/update files
    for path, content in files:
        blob_r = requests.post(
            f"{base}/git/blobs",
            headers=headers,
            json={"content": content, "encoding": "utf-8"},
        )
        blob_r.raise_for_status()
        blob_sha = blob_r.json()["sha"]
        tree_entries.append({"path": path, "mode": "100644", "type": "blob", "sha": blob_sha})

    # Delete only paths that exist in the repo (API errors if we delete a non-existent path)
    if deletes:
        tree_get = requests.get(
            f"{base}/git/trees/{base_tree_sha}",
            headers=headers,
            params={"recursive": "1"},
        )
        tree_get.raise_for_status()
        existing_paths = {item["path"] for item in tree_get.json().get("tree", [])}
        for path in deletes:
            if path in existing_paths:
                tree_entries.append({"path": path, "mode": "100644", "type": "blob", "sha": None})

    if not tree_entries:
        raise ValueError("files must not be empty when no paths to delete exist")

    # Create tree from base + new blobs + deletes
    tree_r = requests.post(
        f"{base}/git/trees",
        headers=headers,
        json={"base_tree": base_tree_sha, "tree": tree_entries},
    )
    tree_r.raise_for_status()
    new_tree_sha = tree_r.json()["sha"]

    # Create commit
    commit_r = requests.post(
        f"{base}/git/commits",
        headers=headers,
        json={"tree": new_tree_sha, "message": message, "parents": [commit_sha]},
    )
    commit_r.raise_for_status()
    new_commit_sha = commit_r.json()["sha"]

    # Update branch ref
    ref_r = requests.patch(
        f"{base}/git/refs/heads/{branch}",
        headers=headers,
        json={"sha": new_commit_sha},
    )
    ref_r.raise_for_status()

    return commit_r.json()