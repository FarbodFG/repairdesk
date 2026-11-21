import io
import logging
from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase

from .run_combined import maybe_start_supervisor, runtime_environment
from .supervisor_fatal_exit import listen


class SupervisorHandoff(Exception):
    pass


class CombinedStartupTests(SimpleTestCase):
    root = Path(__file__).resolve().parent.parent

    def start(self, **environment):
        maybe_start_supervisor(self.root, environment, logging.getLogger("combined-test"))

    @patch("deploy.run_combined.os.execvpe")
    def test_existing_web_only_mode_does_not_start_a_worker(self, execute):
        for value in ("false", "0", "no"):
            self.start(RUN_SMS_WORKER=value)
        self.start()
        execute.assert_not_called()

    @patch("deploy.run_combined.os.execvpe")
    def test_managed_gunicorn_does_not_start_another_manager(self, execute):
        self.start(RUN_SMS_WORKER="true", NOTIFICATION_SEND_MODE="worker", REPAIRDESK_SUPERVISED="1")
        execute.assert_not_called()

    def test_combined_mode_rejects_sync_or_missing_send_mode(self):
        for mode in ("sync", "auto", ""):
            with self.subTest(mode=mode):
                with self.assertRaisesMessage(RuntimeError, "NOTIFICATION_SEND_MODE=worker"):
                    self.start(RUN_SMS_WORKER="true", NOTIFICATION_SEND_MODE=mode)

    def test_invalid_switch_is_not_silently_ignored(self):
        with self.assertRaisesMessage(RuntimeError, "RUN_SMS_WORKER"):
            self.start(RUN_SMS_WORKER="tru")

    @patch("deploy.run_combined.sys.platform", "linux")
    @patch("deploy.run_combined.importlib.util.find_spec", return_value=object())
    @patch("deploy.run_combined.os.execvpe", side_effect=SupervisorHandoff)
    def test_handoff_replaces_master_and_preserves_existing_secrets(self, execute, find_spec):
        with self.assertRaises(SupervisorHandoff):
            self.start(RUN_SMS_WORKER="true", NOTIFICATION_SEND_MODE="worker", SMSIR_API_KEY="test-only-key")
        execute.assert_called_once()
        executable, arguments, environment = execute.call_args.args
        self.assertEqual(arguments[:3], [executable, "-m", "supervisor.supervisord"])
        self.assertEqual(environment["SMSIR_API_KEY"], "test-only-key")
        self.assertEqual(environment["REPAIRDESK_SUPERVISED"], "1")
        # The child consumes the same environment and cannot recursively launch.
        maybe_start_supervisor(self.root, environment, logging.getLogger("combined-test"))
        execute.assert_called_once()

    @patch("deploy.run_combined.sys.platform", "linux")
    @patch("deploy.run_combined.importlib.util.find_spec", return_value=None)
    def test_missing_dependency_fails_with_a_rebuild_instruction(self, find_spec):
        with self.assertRaisesMessage(RuntimeError, "Rebuild"):
            self.start(RUN_SMS_WORKER="true", NOTIFICATION_SEND_MODE="worker")

    def test_status_environment_is_built_without_changing_original(self):
        original = {"DB_PASSWORD": "test-password"}
        result = runtime_environment(self.root, original)
        self.assertEqual(original, {"DB_PASSWORD": "test-password"})
        self.assertEqual(result["DB_PASSWORD"], original["DB_PASSWORD"])
        self.assertEqual(result["REPAIRDESK_PROJECT_ROOT"], str(self.root))


class SupervisorFatalEventTests(SimpleTestCase):
    def test_fatal_event_is_acknowledged_before_shutdown(self):
        payload = "processname:sms_worker groupname:repairdesk"
        stream = io.StringIO(f"ver:3.0 eventname:PROCESS_STATE_FATAL len:{len(payload)}\n{payload}")
        output, errors = io.StringIO(), io.StringIO()
        shutdowns = []
        result = listen(stream, output, errors, lambda: shutdowns.append(True))
        self.assertEqual(result, 0)
        self.assertEqual(shutdowns, [True])
        self.assertEqual(output.getvalue(), "READY\nRESULT 2\nOK")
        self.assertIn("sms_worker", errors.getvalue())

    def test_incomplete_event_cannot_trigger_shutdown(self):
        stream = io.StringIO("eventname:PROCESS_STATE_FATAL len:100\nshort")
        shutdowns = []
        self.assertEqual(listen(stream, io.StringIO(), io.StringIO(), lambda: shutdowns.append(True)), 1)
        self.assertEqual(shutdowns, [])
