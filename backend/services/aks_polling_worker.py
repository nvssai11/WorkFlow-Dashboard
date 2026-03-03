from __future__ import annotations

import datetime
import logging
import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Optional

from backend import db as app_db
from backend.config import settings
from backend.services.aks_log_monitor import fetch_error_region, reader

logger = logging.getLogger(__name__)


@dataclass
class AKSLogSource:
    workflow: str
    namespace: str
    selector: str
    container: Optional[str] = None


def parse_sources(value: str) -> list[AKSLogSource]:
    """
    Parses AKS_MONITOR_SOURCES:
    workflow|namespace|label_selector|container ; workflow2|namespace2|selector2|
    """
    raw_items = [item.strip() for item in value.split(";") if item.strip()]
    sources: list[AKSLogSource] = []
    for raw in raw_items:
        parts = [p.strip() for p in raw.split("|")]
        if len(parts) < 3:
            continue
        workflow, namespace, selector = parts[0], parts[1], parts[2]
        container = parts[3] if len(parts) >= 4 and parts[3] else None
        if not workflow or not namespace or not selector:
            continue
        sources.append(
            AKSLogSource(
                workflow=workflow,
                namespace=namespace,
                selector=selector,
                container=container,
            )
        )
    return sources


class AKSFailurePollingWorker:
    def __init__(self) -> None:
        self._thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._running = False
        self._last_seen: dict[str, float] = {}
        self._lock = threading.Lock()
        self._last_poll_at: Optional[str] = None
        self._last_success_at: Optional[str] = None
        self._last_error: Optional[str] = None
        self._kubectl_reachable: Optional[bool] = None
        self._last_result: dict[str, int] = {"detected": 0, "stored": 0}
        self._last_error_log_signature: Optional[str] = None
        self._last_error_log_at: float = 0.0
        self._raw_log_buffer: list[dict[str, object]] = []

    def is_running(self) -> bool:
        with self._lock:
            return self._running

    def status(self) -> dict[str, object]:
        return {
            "running": self.is_running(),
            "enabled": bool(settings.AKS_MONITOR_ENABLED),
            "pollSeconds": int(max(5, settings.AKS_MONITOR_POLL_SECONDS)),
            "sources": [s.__dict__ for s in parse_sources(settings.AKS_MONITOR_SOURCES)],
            "lastPollAt": self._last_poll_at,
            "lastSuccessAt": self._last_success_at,
            "lastError": self._last_error,
            "kubectlReachable": self._kubectl_reachable,
            "lastResult": self._last_result,
            "rawLogEntries": len(self._raw_log_buffer),
        }

    def get_raw_logs(self, limit: int = 500) -> list[dict[str, object]]:
        n = max(1, min(limit, 5000))
        return self._raw_log_buffer[-n:]

    def _append_raw_logs(self, source: AKSLogSource, lines: list[str]) -> None:
        polled_at = datetime.datetime.utcnow().isoformat() + "Z"
        for line in lines:
            self._raw_log_buffer.append(
                {
                    "timestamp": polled_at,
                    "workflow": source.workflow,
                    "namespace": source.namespace,
                    "selector": source.selector,
                    "line": line,
                }
            )
        if len(self._raw_log_buffer) > 10000:
            self._raw_log_buffer = self._raw_log_buffer[-10000:]

    def _set_poll_health(
        self,
        *,
        error: Optional[str],
        kubectl_reachable: Optional[bool],
        result: Optional[dict[str, int]] = None,
        success: bool = False,
    ) -> None:
        now_iso = datetime.datetime.utcnow().isoformat() + "Z"
        self._last_poll_at = now_iso
        self._last_error = error
        self._kubectl_reachable = kubectl_reachable
        if result is not None:
            self._last_result = result
        if success:
            self._last_success_at = now_iso

    def _log_error_throttled(self, signature: str, message: str) -> None:
        now = time.time()
        if (
            self._last_error_log_signature == signature
            and (now - self._last_error_log_at) < 120
        ):
            return
        self._last_error_log_signature = signature
        self._last_error_log_at = now
        logger.warning(message)

    def start(self) -> None:
        if self.is_running():
            return
        if not settings.AKS_MONITOR_ENABLED:
            logger.info("AKS monitor disabled via AKS_MONITOR_ENABLED=false")
            return
        sources = parse_sources(settings.AKS_MONITOR_SOURCES)
        if not sources:
            logger.warning("AKS monitor enabled but AKS_MONITOR_SOURCES is empty")
            return

        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="aks-failure-poller", daemon=True)
        with self._lock:
            self._running = True
        self._thread.start()
        logger.info("Started AKS failure polling worker with %s source(s)", len(sources))

    def stop(self) -> None:
        self._stop.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2)
        with self._lock:
            self._running = False

    def _run(self) -> None:
        poll_seconds = int(max(5, settings.AKS_MONITOR_POLL_SECONDS))
        while not self._stop.is_set():
            try:
                self.poll_once()
            except Exception as exc:
                logger.exception("AKS polling cycle failed: %s", exc)
            self._stop.wait(poll_seconds)
        with self._lock:
            self._running = False

    def _build_kubectl_cmd(self, source: AKSLogSource, since_seconds: int) -> list[str]:
        cmd = [
            "kubectl",
            "logs",
            "-n",
            source.namespace,
            "-l",
            source.selector,
            f"--since={since_seconds}s",
            "--tail=500",
            "--all-containers=true",
            "--prefix",
        ]
        if source.container:
            cmd.extend(["-c", source.container])
        return cmd

    def _should_skip_duplicate(self, dedup_key: str) -> bool:
        now = time.time()
        dedup_seconds = int(max(30, settings.AKS_MONITOR_DEDUP_SECONDS))
        last = self._last_seen.get(dedup_key)
        if last and (now - last) < dedup_seconds:
            return True
        self._last_seen[dedup_key] = now
        if len(self._last_seen) > 5000:
            cutoff = now - dedup_seconds
            self._last_seen = {k: ts for k, ts in self._last_seen.items() if ts >= cutoff}
        return False

    def poll_once(self) -> dict[str, int]:
        sources = parse_sources(settings.AKS_MONITOR_SOURCES)
        if not sources:
            result = {"detected": 0, "stored": 0}
            self._set_poll_health(
                error="AKS_MONITOR_SOURCES is empty",
                kubectl_reachable=None,
                result=result,
                success=False,
            )
            return result

        total_detected = 0
        total_stored = 0
        since_seconds = int(max(10, settings.AKS_MONITOR_POLL_SECONDS) + 5)
        github_login = settings.AGENT_DEFAULT_GITHUB_LOGIN or "system"
        had_connectivity_failure = False
        last_connectivity_error: Optional[str] = None

        for source in sources:
            cmd = self._build_kubectl_cmd(source, since_seconds)
            try:
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=40, check=False)
            except FileNotFoundError:
                msg = "kubectl not found; install kubectl and ensure it is on PATH"
                self._log_error_throttled("kubectl-not-found", msg)
                out = {"detected": total_detected, "stored": total_stored}
                self._set_poll_health(error=msg, kubectl_reachable=False, result=out, success=False)
                return out
            except subprocess.TimeoutExpired:
                had_connectivity_failure = True
                last_connectivity_error = f"kubectl logs timed out for {source.namespace}/{source.selector}"
                self._log_error_throttled(
                    f"timeout-{source.namespace}-{source.selector}",
                    last_connectivity_error,
                )
                continue

            if result.returncode != 0:
                stderr = (result.stderr or "").strip()
                if stderr:
                    had_connectivity_failure = True
                    last_connectivity_error = f"kubectl logs failed for {source.selector}: {stderr}"
                    self._log_error_throttled(
                        f"kubectl-fail-{source.selector}-{stderr[:160]}",
                        last_connectivity_error,
                    )
                continue

            lines = [line for line in (result.stdout or "").splitlines() if line.strip()]
            if not lines:
                continue
            self._append_raw_logs(source, lines)

            detections = reader(lines, max_detections=50)
            total_detected += len(detections)

            for detection in detections:
                try:
                    region = fetch_error_region(lines, int(detection["line_number"]), before=6, after=6)
                except ValueError:
                    continue

                dedup_key = "|".join(
                    [
                        source.workflow,
                        str(region["error_line_number"]),
                        str(region["error_line"])[:200],
                        str(detection.get("matched_keyword", "")),
                    ]
                )
                if self._should_skip_duplicate(dedup_key):
                    continue

                timestamp = detection.get("timestamp") or (datetime.datetime.utcnow().isoformat() + "Z")
                app_db.insert_agent_failure(
                    github_login=github_login,
                    workflow=source.workflow,
                    source="aks",
                    pod_name=source.selector,
                    timestamp=str(timestamp),
                    error_line_number=int(region["error_line_number"]),
                    error_line=str(region["error_line"]),
                    matched_keyword=str(detection.get("matched_keyword") or ""),
                    log_block=str(region["block"]),
                )
                total_stored += 1

        out = {"detected": total_detected, "stored": total_stored}
        if had_connectivity_failure and total_detected == 0 and total_stored == 0:
            self._set_poll_health(
                error=last_connectivity_error,
                kubectl_reachable=False,
                result=out,
                success=False,
            )
        else:
            self._set_poll_health(
                error=None,
                kubectl_reachable=True,
                result=out,
                success=True,
            )
        return out


aks_failure_worker = AKSFailurePollingWorker()
