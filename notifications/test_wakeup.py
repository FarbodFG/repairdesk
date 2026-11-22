"""Runs with Django tests or plain `python -m unittest` on Linux."""

import os
from pathlib import Path
from queue import Queue
import socket
from tempfile import TemporaryDirectory
from threading import Event, Thread
import unittest

from .wakeup import QueueWakeup, notify_worker


@unittest.skipUnless(os.name == "posix" and hasattr(socket, "AF_UNIX"), "Unix local sockets require Linux/POSIX")
class LocalWakeupTests(unittest.TestCase):
    def setUp(self):
        self.directory = TemporaryDirectory(prefix="repairdesk-wake-test-")
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "wake.sock"

    def test_waiting_worker_is_woken_without_waiting_for_the_poll_interval(self):
        done = Queue()
        with QueueWakeup(self.path) as wakeup:
            self.assertIsNotNone(wakeup.receiver)
            def wait():
                wakeup.wait(Event(), 3)
                done.put(True)
            thread = Thread(target=wait)
            thread.start()
            self.assertTrue(notify_worker(self.path))
            self.assertTrue(done.get(timeout=1))
            thread.join(timeout=1)
        self.assertFalse(self.path.exists())

    def test_absent_worker_does_not_raise_or_create_files(self):
        self.assertFalse(notify_worker(self.path))
        self.assertFalse(self.path.exists())

    def test_stale_socket_after_a_crash_is_reclaimed(self):
        with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as old:
            old.bind(str(self.path))
        with QueueWakeup(self.path) as wakeup:
            self.assertIsNotNone(wakeup.receiver)
            self.assertTrue(notify_worker(self.path))

    def test_existing_active_listener_is_not_replaced(self):
        with QueueWakeup(self.path) as first:
            identity = self.path.stat().st_ino
            with QueueWakeup(self.path) as second:
                self.assertIsNone(second.receiver)
                self.assertEqual(self.path.stat().st_ino, identity)
                self.assertIsNotNone(first.receiver)
                self.assertTrue(notify_worker(self.path))

    def test_an_unrelated_file_is_never_deleted(self):
        self.path.write_text("keep this file")
        with self.assertLogs("notifications.wakeup", level="WARNING"):
            with QueueWakeup(self.path) as wakeup:
                self.assertIsNone(wakeup.receiver)
        self.assertEqual(self.path.read_text(), "keep this file")

    def test_closing_an_old_instance_cannot_delete_a_new_listener(self):
        first = QueueWakeup(self.path).__enter__()
        first.__exit__()
        with QueueWakeup(self.path) as second:
            first.__exit__()
            self.assertIsNotNone(second.receiver)
            self.assertTrue(notify_worker(self.path))
