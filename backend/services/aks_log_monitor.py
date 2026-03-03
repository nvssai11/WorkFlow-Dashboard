from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from datetime import datetime
from typing import Iterable, Sequence

DEFAULT_ERROR_KEYWORDS: tuple[str, ...] = (
    "error",
    "failed",
    "exception",
    "fatal",
    "crash",
    "panic",
    "timeout",
    "refused",
    "unavailable",
)

_TIMESTAMP_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z"),
    re.compile(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}"),
)


@dataclass
class LogDetection:
    line_number: int
    line: str
    matched_keyword: str
    timestamp: str | None = None


def _extract_timestamp(line: str) -> str | None:
    for pattern in _TIMESTAMP_PATTERNS:
        match = pattern.search(line)
        if match:
            value = match.group(0)
            if value.endswith("Z"):
                return value
            try:
                return datetime.fromisoformat(value).isoformat()
            except ValueError:
                return value
    return None


def reader(
    log_lines: Sequence[str] | Iterable[str],
    *,
    start_line_number: int = 1,
    keywords: Sequence[str] | None = None,
    max_detections: int | None = None,
) -> list[dict[str, str | int | None]]:
    """
    Rule-based log polling detector.

    Scans lines and returns every line containing any error keyword.
    """
    active_keywords = tuple(k.lower() for k in (keywords or DEFAULT_ERROR_KEYWORDS))
    detections: list[LogDetection] = []

    for idx, raw_line in enumerate(log_lines):
        line_number = start_line_number + idx
        line = raw_line.rstrip("\n")
        lowered = line.lower()
        matched = next((k for k in active_keywords if k in lowered), None)
        if not matched:
            continue

        detections.append(
            LogDetection(
                line_number=line_number,
                line=line,
                matched_keyword=matched,
                timestamp=_extract_timestamp(line),
            )
        )
        if max_detections is not None and len(detections) >= max_detections:
            break

    return [asdict(item) for item in detections]


def fetch_error_region(
    log_lines: Sequence[str] | Iterable[str],
    error_line_number: int,
    *,
    before: int = 6,
    after: int = 6,
) -> dict[str, str | int]:
    """
    Fetches a context block around an error line number.
    """
    if error_line_number < 1:
        raise ValueError("error_line_number must be >= 1")
    if before < 0 or after < 0:
        raise ValueError("before/after must be >= 0")

    lines = list(log_lines)
    if not lines:
        raise ValueError("log_lines is empty")

    index = error_line_number - 1
    if index >= len(lines):
        raise ValueError("error_line_number exceeds log length")

    start_index = max(0, index - before)
    end_index = min(len(lines) - 1, index + after)

    block_parts: list[str] = []
    for i in range(start_index, end_index + 1):
        prefix = ">>" if i == index else "  "
        block_parts.append(f"{prefix} {i + 1}: {lines[i].rstrip()}")

    return {
        "error_line_number": error_line_number,
        "start_line_number": start_index + 1,
        "end_line_number": end_index + 1,
        "error_line": lines[index].rstrip(),
        "block": "\n".join(block_parts),
    }
