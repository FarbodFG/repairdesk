import json
import os
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

from django.db import OperationalError
from django.test import SimpleTestCase, TestCase, override_settings


class HealthTests(TestCase):
    @override_settings(
        SECURE_SSL_REDIRECT=True,
        SECURE_REDIRECT_EXEMPT=[r"^healthz/$", r"^readyz/$"],
    )
    def test_internal_http_probes_are_not_redirected(self):
        self.assertEqual(self.client.get("/healthz/").status_code, 200)
        self.assertEqual(self.client.get("/readyz/").status_code, 200)

    def test_database_outage_affects_readiness_but_not_liveness(self):
        with patch("repair_desk.health.connection.cursor", side_effect=OperationalError("private-error")):
            self.assertEqual(self.client.get("/healthz/").status_code, 200)
            response = self.client.get("/readyz/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "unavailable"})
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertNotContains(response, "private-error", status_code=503)


class ProductionSettingsTests(SimpleTestCase):
    def load_settings(self, **changes):
        env = os.environ.copy()
        env.update({
            "DJANGO_SECRET_KEY": "a-long-random-test-key-" * 4,
            "DJANGO_ALLOWED_HOSTS": "app.example.test,repairdesk-api",
            "DB_NAME": "test_db", "DB_USER": "test_user",
            "DB_PASSWORD": "not-a-real-password", "DB_HOST": "mysql.internal",
            "DJANGO_TRUST_PROXY": "true",
        })
        for name, value in changes.items():
            if value is None:
                env.pop(name, None)
            else:
                env[name] = value
        return subprocess.run(
            [sys.executable, "-c", (
                "import json; import repair_desk.production_settings as s; "
                "print(json.dumps({'debug':s.DEBUG,'hosts':s.ALLOWED_HOSTS,"
                "'secure_cookie':s.SESSION_COOKIE_SECURE,"
                "'proxy':s.SECURE_PROXY_SSL_HEADER,"
                "'db_host':s.DATABASES['default']['HOST']}))"
            )],
            cwd=Path(__file__).resolve().parent.parent,
            env=env, capture_output=True, text=True,
        )

    def test_production_overrides_development_debug_and_uses_runtime_values(self):
        result = self.load_settings(DJANGO_DEBUG="true")
        self.assertEqual(result.returncode, 0, result.stderr)
        actual = json.loads(result.stdout)
        self.assertFalse(actual["debug"])
        self.assertTrue(actual["secure_cookie"])
        self.assertEqual(actual["db_host"], "mysql.internal")
        self.assertEqual(actual["proxy"], ["HTTP_X_FORWARDED_PROTO", "https"])

    def test_missing_production_credentials_fail_closed(self):
        for variable in ("DJANGO_SECRET_KEY", "DB_PASSWORD", "DB_HOST"):
            with self.subTest(variable=variable):
                result = self.load_settings(**{variable: None})
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(variable, result.stderr)

    def test_wildcard_hosts_are_rejected(self):
        result = self.load_settings(DJANGO_ALLOWED_HOSTS="*")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_ALLOWED_HOSTS", result.stderr)
