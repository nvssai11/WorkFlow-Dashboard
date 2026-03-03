"""
Use Azure OpenAI–compatible API (e.g. DeepSeek) to analyze a failure log and return root cause and suggested fix.
"""
import json
import logging
import urllib.request
from typing import Optional

from backend.config import settings

logger = logging.getLogger("uvicorn.error")

_PROMPT_PREFIX = """You are a DevOps/SRE expert. Given a failure log snippet, respond with exactly two lines (no extra text):
ROOT_CAUSE: <one or two sentences explaining the most likely root cause>
SUGGESTED_FIX: <one or two sentences with a concrete fix>

Failure details (line where failure occurred):
"""
_PROMPT_SUFFIX = """

Matched log block (context around the error):
"""


def analyze_failure(error_line: str, log_block: str) -> tuple[Optional[str], Optional[str]]:
    """
    Call the LLM to get root cause and suggested fix. Returns (root_cause, fix_suggestion);
    on API error or parse failure returns (None, None). Truncate inputs to avoid token limits.
    """
    api_key = (settings.AZURE_OPENAI_API_KEY or "").strip()
    if not api_key:
        logger.debug("AZURE_OPENAI_API_KEY not set; skipping failure analysis")
        return (None, None)

    url = (settings.AZURE_OPENAI_CHAT_URL or "").strip() or "https://dskit-mm7qk81m-eastus2.cognitiveservices.azure.com/openai/v1/chat/completions"
    err = (error_line or "")[:800]
    block = (log_block or "")[:3000]
    user_content = _PROMPT_PREFIX + err + _PROMPT_SUFFIX + block

    payload = {
        "messages": [
            {"role": "system", "content": "You respond only with ROOT_CAUSE: and SUGGESTED_FIX: lines. No markdown, no code fences."},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": 400,
        "model": "DeepSeek-V3-0324",
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "api-key": api_key},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        logger.warning("Failure analysis LLM request failed: %s", e)
        return (None, None)

    choices = data.get("choices") or []
    if not choices:
        return (None, None)
    content = ((choices[0].get("message") or {}).get("content") or "").strip()
    if not content:
        return (None, None)

    root_cause: Optional[str] = None
    suggested_fix: Optional[str] = None
    for line in content.splitlines():
        line = line.strip()
        if line.upper().startswith("ROOT_CAUSE:"):
            root_cause = line.split(":", 1)[-1].strip()
        elif line.upper().startswith("SUGGESTED_FIX:"):
            suggested_fix = line.split(":", 1)[-1].strip()

    if root_cause:
        root_cause = root_cause[:1000]
    if suggested_fix:
        suggested_fix = suggested_fix[:1000]
    return (root_cause, suggested_fix)
