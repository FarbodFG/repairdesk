"""Restart the container if a managed service exhausts its startup retries."""

import os
import signal
import sys


def listen(stdin, stdout, stderr, shutdown) -> int:
    while True:
        stdout.write("READY\n")
        stdout.flush()
        header = stdin.readline()
        if not header:
            return 1
        fields = dict(field.split(":", 1) for field in header.split())
        size = int(fields["len"])
        payload = stdin.read(size)
        if len(payload) != size:
            return 1
        stdout.write("RESULT 2\nOK")
        stdout.flush()
        if fields.get("eventname") == "PROCESS_STATE_FATAL":
            # Payload names the failed process; it does not contain env secrets.
            stderr.write(f"Managed service failed permanently: {payload}\n")
            stderr.flush()
            shutdown()
            return 0


if __name__ == "__main__":
    raise SystemExit(listen(
        sys.stdin, sys.stdout, sys.stderr,
        lambda: os.kill(os.getppid(), signal.SIGTERM),
    ))
