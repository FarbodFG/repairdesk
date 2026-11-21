"""Opt-in Supervisor handoff before Gunicorn binds its listening socket."""

import importlib.util
import os
from pathlib import Path
import subprocess
import sys


def runtime_environment(project_root: Path, environment: dict[str, str]) -> dict[str, str]:
    return {
        **environment,
        "PYTHONUNBUFFERED": "1",
        "REPAIRDESK_PROJECT_ROOT": str(project_root),
        "REPAIRDESK_PYTHON": sys.executable,
        "REPAIRDESK_SUPERVISED": "1",
    }


def maybe_start_supervisor(project_root: Path, environment: dict[str, str], logger) -> None:
    enabled = environment.get("RUN_SMS_WORKER", "false").strip().lower()
    if enabled not in {"true", "false", "1", "0", "yes", "no"}:
        raise RuntimeError("RUN_SMS_WORKER must be true or false.")
    if enabled in {"false", "0", "no"}:
        return
    if environment.get("NOTIFICATION_SEND_MODE", "").strip().lower() != "worker":
        raise RuntimeError("Set NOTIFICATION_SEND_MODE=worker when RUN_SMS_WORKER=true.")
    # The managed Gunicorn child must never start another manager or sender.
    if environment.get("REPAIRDESK_SUPERVISED") == "1":
        return
    if sys.platform == "win32":
        raise RuntimeError("Combined web/worker mode runs on Linux, not Windows.")
    if importlib.util.find_spec("supervisor") is None:
        raise RuntimeError("Supervisor is missing. Rebuild using the updated requirements.txt.")
    environment = runtime_environment(project_root, environment)
    logger.info("Starting combined Django web and SMS worker with Supervisor")
    # Replace the initial master before binding sockets or forking web workers.
    # This keeps the platform's existing startup command and environment intact.
    os.execvpe(
        sys.executable,
        [sys.executable, "-m", "supervisor.supervisord", "-n", "-c", str(project_root / "deploy/supervisord.conf")],
        environment,
    )


def main() -> int:
    if sys.argv[1:] != ["status"]:
        print("Usage: python deploy/run_combined.py status", file=sys.stderr)
        return 2
    project_root = Path(__file__).resolve().parent.parent
    return subprocess.call(
        [sys.executable, "-m", "supervisor.supervisorctl", "-c", str(project_root / "deploy/supervisord.conf"), "status"],
        env=runtime_environment(project_root, dict(os.environ)),
    )


if __name__ == "__main__":
    raise SystemExit(main())
