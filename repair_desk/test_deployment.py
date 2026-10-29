"""Regression coverage for admin assets in a fresh production container."""

import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory

from django.test import SimpleTestCase


class ProductionStaticStartupTests(SimpleTestCase):
    def test_fresh_start_collects_manifest_and_serves_admin_assets(self):
        project_root = Path(__file__).resolve().parent.parent
        with TemporaryDirectory() as temporary_dir:
            static_root = Path(temporary_dir) / "staticfiles"
            (Path(temporary_dir) / "startup_test_settings.py").write_text(
                "from repair_desk.production_settings import *\n"
                f"STATIC_ROOT = {str(static_root)!r}\n",
                encoding="utf-8",
            )
            env = {
                **os.environ,
                "PYTHONPATH": os.pathsep.join(
                    [temporary_dir, str(project_root), os.getenv("PYTHONPATH", "")]
                ),
                "DJANGO_SETTINGS_MODULE": "startup_test_settings",
                "DJANGO_SECRET_KEY": "startup-test-only-key-" * 4,
                "DJANGO_ALLOWED_HOSTS": "testserver",
                "DJANGO_TRUST_PROXY": "true",
                "DJANGO_SECURE_SSL_REDIRECT": "true",
                "DB_NAME": "unused", "DB_USER": "unused",
                "DB_PASSWORD": "test-only", "DB_HOST": "unused.invalid",
            }
            result = subprocess.run(
                [sys.executable, "-c", """
import json
import logging
import os
from pathlib import Path
import runpy
from types import SimpleNamespace

config = runpy.run_path('gunicorn.conf.py')
server = SimpleNamespace(
    log=logging.getLogger('startup-test'),
    cfg=SimpleNamespace(env={'DJANGO_SETTINGS_MODULE': os.environ['DJANGO_SETTINGS_MODULE']}),
)
config['on_starting'](server)

# Import the application only after the startup hook, as Gunicorn does.
import django
django.setup()
from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage
from django.test import Client

manifest = json.loads((Path(settings.STATIC_ROOT) / 'staticfiles.json').read_text())
assert 'admin/css/base.css' in manifest['paths']
client = Client()
response = client.get('/admin/login/', HTTP_X_FORWARDED_PROTO='https')
assert response.status_code == 200, response.status_code
css_url = staticfiles_storage.url('admin/css/base.css')
assert css_url.encode() in response.content
css = client.get(css_url, HTTP_X_FORWARDED_PROTO='https')
assert css.status_code == 200, css.status_code
css.close()
"""],
                cwd=project_root, env=env, capture_output=True, text=True,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
