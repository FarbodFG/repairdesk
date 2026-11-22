"""Best-effort local wakeups; the database remains the durable queue.

Unix datagrams avoid polling latency when web and sender share a container.
Missing/full sockets never block an HTTP request; periodic polling is fallback.
"""

import errno
import logging
import os
from pathlib import Path
import select
import socket
import stat
import tempfile


logger = logging.getLogger(__name__)


def socket_path():
    return Path(tempfile.gettempdir()) / "repairdesk-notifications.sock"


def notify_worker(path=None):
    if os.name != "posix" or not hasattr(socket, "AF_UNIX"):
        return False
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as sender:
            sender.setblocking(False)
            sender.sendto(b"wake", str(path or socket_path()))
        return True
    except OSError:
        return False


class QueueWakeup:
    def __init__(self, path=None):
        self.path = Path(path or socket_path())
        self.receiver = None
        self.identity = None

    def __enter__(self):
        if os.name != "posix" or not hasattr(socket, "AF_UNIX"):
            return self
        receiver = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
        receiver.setblocking(False)
        try:
            for attempt in range(2):
                try:
                    receiver.bind(str(self.path))
                    break
                except OSError as error:
                    if attempt or error.errno != errno.EADDRINUSE:
                        raise
                    before = self.path.lstat()
                    if not stat.S_ISSOCK(before.st_mode) or before.st_uid != os.getuid():
                        raise
                    # Do not remove the socket of another active sender.
                    try:
                        receiver.sendto(b"wake", str(self.path))
                    except OSError as probe_error:
                        if probe_error.errno != errno.ECONNREFUSED:
                            raise
                        after = self.path.lstat()
                        if (before.st_dev, before.st_ino) != (after.st_dev, after.st_ino):
                            raise
                        self.path.unlink()
                    else:
                        receiver.close()
                        return self
            self.receiver = receiver
            info = self.path.lstat()
            self.identity = (info.st_dev, info.st_ino)
            os.chmod(self.path, 0o600)
        except OSError:
            receiver.close()
            self.receiver = None
            logger.warning("Local SMS wakeup unavailable; using periodic polling")
        return self

    def wait(self, stopped, timeout):
        if stopped.is_set():
            return
        if self.receiver is None:
            stopped.wait(timeout)
            return
        try:
            readable, _, _ = select.select([self.receiver], [], [], timeout)
            if readable:
                # Coalesce bursts without delaying processing indefinitely.
                for _ in range(64):
                    try:
                        self.receiver.recv(1024)
                    except BlockingIOError:
                        break
        except OSError:
            stopped.wait(min(timeout, 0.5))

    def __exit__(self, *args):
        if self.receiver is not None:
            self.receiver.close()
            self.receiver = None
        if self.identity is not None:
            try:
                info = self.path.lstat()
                if (info.st_dev, info.st_ino) == self.identity:
                    self.path.unlink()
            except OSError:
                pass
            self.identity = None
