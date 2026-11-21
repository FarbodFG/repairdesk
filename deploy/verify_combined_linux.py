"""Exercise real Gunicorn/Supervisor lifecycle with isolated, non-SMS workloads.

Run on Linux: python deploy/verify_combined_linux.py --wheel-dir PATH
No dependencies are installed globally. No project database or SMS API is used.
"""

import argparse
import http.client
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parent.parent


def wait_for(check, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        value = check()
        if value:
            return value
        time.sleep(0.2)
    raise AssertionError("Timed out waiting for isolated combined-service test.")


def verify(wheel_dir):
    with TemporaryDirectory(prefix="repairdesk-combined-") as directory:
        root = Path(directory)
        packages = root / "packages"
        packages.mkdir()
        # Supervisor reads version.txt by filename, so wheels must be unpacked.
        for wheel in wheel_dir.glob("*.whl"):
            with ZipFile(wheel) as archive:
                if any(Path(name).is_absolute() or ".." in Path(name).parts for name in archive.namelist()):
                    raise ValueError("Unsafe wheel path.")
                archive.extractall(packages)
        (root / "deploy").mkdir()
        for name in ("__init__.py", "run_combined.py", "supervisor_fatal_exit.py"):
            shutil.copyfile(ROOT / "deploy" / name, root / "deploy" / name)
        config = (ROOT / "deploy/supervisord.conf").read_text()
        config = config.replace("/tmp/repairdesk-supervisor.sock", str(root / "supervisor.sock"))
        config = config.replace("/tmp/repairdesk-supervisord.pid", str(root / "supervisor.pid"))
        # Exercise the same failure path faster, without waiting for five retries.
        config = config.replace("startretries=5", "startretries=1")
        (root / "deploy/supervisord.conf").write_text(config)
        shutil.copyfile(ROOT / "gunicorn.conf.py", root / "gunicorn.conf.py")
        (root / "repair_desk").mkdir()
        (root / "repair_desk/__init__.py").write_text("")
        (root / "repair_desk/wsgi.py").write_text(
            "def application(environ, start_response):\n"
            "    start_response('200 OK', [('Content-Type', 'text/plain')])\n"
            "    return [b'isolated-combined-test']\n"
        )
        (root / "manage.py").write_text('''
import os, signal, sys
from pathlib import Path
from threading import Event
if sys.argv[1] == "collectstatic":
    with Path("static-starts").open("a") as stream:
        stream.write("collected\\n")
elif sys.argv[1] == "run_notification_worker":
    if os.getenv("FAIL_WORKER_STARTUP") == "1":
        raise SystemExit(2)
    with Path("worker-starts").open("a") as stream:
        stream.write(str(os.getpid()) + "\\n")
    stopped = Event()
    signal.signal(signal.SIGTERM, lambda *_: stopped.set())
    stopped.wait()
    Path("worker-stopped").write_text("graceful")
else:
    raise SystemExit(2)
''')
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env = {
            **os.environ, "RUN_SMS_WORKER": "true", "NOTIFICATION_SEND_MODE": "worker",
            "WEB_CONCURRENCY": "3", "GUNICORN_THREADS": "1", "PORT": str(port),
            "PYTHONPATH": str(packages),
            "REPAIRDESK_PROJECT_ROOT": str(root), "REPAIRDESK_PYTHON": sys.executable,
            "GUNICORN_CMD_ARGS": f"--bind 127.0.0.1:{port}",
        }
        env.pop("REPAIRDESK_SUPERVISED", None)
        env.pop("FAIL_WORKER_STARTUP", None)

        def control(*arguments):
            return subprocess.run(
                [sys.executable, "-m", "supervisor.supervisorctl", "-c", str(root / "deploy/supervisord.conf"), *arguments],
                env=env, cwd=root, capture_output=True, text=True, timeout=5,
            )

        def healthy():
            result = control("status")
            return result.stdout if result.returncode == 0 else None

        def http_ready():
            try:
                connection = http.client.HTTPConnection("127.0.0.1", port, timeout=1)
                connection.request("GET", "/")
                response = connection.getresponse()
                body = response.read()
                connection.close()
                return response.status == 200 and body == b"isolated-combined-test"
            except OSError:
                return False

        with (root / "process.log").open("w+") as log:
            command = [sys.executable, "-m", "gunicorn", "--config", str(root / "gunicorn.conf.py")]
            process = subprocess.Popen(command, cwd=root, env=env, stdout=log, stderr=log)
            try:
                status = wait_for(healthy)
                assert sum("repairdesk:sms_worker" in line for line in status.splitlines()) == 1, status
                assert "repairdesk:web" in status, status
                terminal_env = {
                    key: value for key, value in env.items()
                    if not key.startswith("REPAIRDESK_")
                }
                terminal_status = subprocess.run(
                    [sys.executable, "deploy/run_combined.py", "status"],
                    cwd=root, env=terminal_env, capture_output=True, text=True, timeout=5,
                )
                assert terminal_status.returncode == 0, terminal_status.stdout + terminal_status.stderr
                assert "repairdesk:sms_worker" in terminal_status.stdout
                wait_for(http_ready)
                assert (root / "static-starts").read_text().splitlines() == ["collected"]
                assert len((root / "worker-starts").read_text().splitlines()) == 1
                old_pid = int(control("pid", "repairdesk:sms_worker").stdout.strip())
                assert Path(f"/proc/{old_pid}/cwd").resolve() == root
                os.kill(old_pid, signal.SIGKILL)
                wait_for(lambda: len((root / "worker-starts").read_text().splitlines()) == 2)
                wait_for(healthy)
                new_pid = int(control("pid", "repairdesk:sms_worker").stdout.strip())
                assert new_pid != old_pid
                process.terminate()
                assert process.wait(timeout=35) == 0
                assert (root / "worker-stopped").read_text() == "graceful"
                assert not http_ready(), "Web listener survived manager shutdown."
                print("PASS: actual handoff, HTTP, one sender with three web workers, crash restart, graceful stop")

                failed_env = {**env, "FAIL_WORKER_STARTUP": "1"}
                process = subprocess.Popen(command, cwd=root, env=failed_env, stdout=log, stderr=log)
                assert process.wait(timeout=30) == 0
                log.flush()
                log.seek(0)
                assert "Managed service failed permanently: processname:sms_worker" in log.read()
                print("PASS: repeated startup failure shuts down the manager for platform restart")
            except Exception:
                log.flush()
                log.seek(0)
                print(log.read()[-12000:], file=sys.stderr)
                raise
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=35)
                    except subprocess.TimeoutExpired:
                        control("shutdown")
                        process.wait(timeout=5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wheel-dir", type=Path, required=True)
    args = parser.parse_args()
    if not sys.platform.startswith("linux"):
        parser.error("This integration check requires Linux.")
    verify(args.wheel_dir.resolve())
