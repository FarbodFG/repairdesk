"""Run the unchanged Django API with a disposable, isolated test database."""
import os
import sys
import tempfile
from datetime import timedelta
from pathlib import Path
from socketserver import ThreadingMixIn
from wsgiref.simple_server import make_server, WSGIRequestHandler, WSGIServer


class ThreadedTestServer(ThreadingMixIn, WSGIServer):
    # Browsers may preconnect and cancel requests during route changes. A
    # single-thread WSGI server can block behind an idle socket indefinitely.
    daemon_threads = True
    request_queue_size = 64


class QuietHandler(WSGIRequestHandler):
    def log_message(self, format, *args):
        # Keep server errors visible without logging every successful API request.
        if len(args) > 1 and str(args[1]).startswith('5'):
            super().log_message(format, *args)

if '--isolated' not in sys.argv:
    raise SystemExit('This test server requires --isolated. It never uses the project database.')

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root))
os.environ['DJANGO_SETTINGS_MODULE'] = 'repair_desk.settings'

with tempfile.TemporaryDirectory(prefix='repairdesk-e2e-') as temporary:
    from django.conf import settings
    settings.DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': str(Path(temporary) / 'test.sqlite3')}}
    settings.SECRET_KEY = 'disposable-local-test-server-not-a-production-secret'
    settings.DEBUG = False
    settings.ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
    settings.CORS_ALLOWED_ORIGINS = ['http://127.0.0.1:5174']
    settings.MEDIA_ROOT = str(Path(temporary) / 'media')
    settings.PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
    settings.SIMPLE_JWT = {'ACCESS_TOKEN_LIFETIME': timedelta(seconds=8), 'REFRESH_TOKEN_LIFETIME': timedelta(hours=1)}

    import django
    django.setup()
    from django.core.management import call_command
    from django.core.wsgi import get_wsgi_application
    from accounts.models import User
    from shops.models import RepairShop
    from customers.models import Customer, Device
    from devices.models import Brand, DeviceModel
    from repairs.models import RepairOrder

    call_command('migrate', verbosity=0, interactive=False)
    shop = RepairShop.objects.create(title='تعمیرگاه آزمایشی — داده موقت')
    for username, role in [('qa_manager', 1), ('qa_reception', 2), ('qa_technician', 3)]:
        User.objects.create_user(username=username, password='Isolated-Test-Only!4729', role=role, repair_shop=shop)
    technician = User.objects.get(username='qa_technician')
    customer = Customer.objects.create(name='مشتری آزمایشی', phone_number='09120000000', repair_shop=shop)
    brand = Brand.objects.create(name='Test Brand')
    model = DeviceModel.objects.create(brand=brand, name='Test Phone', search_aliases='آزمایش')
    device = Device.objects.create(customer=customer, device_model=model)
    for index in range(25):
        RepairOrder.objects.create(repair_shop=shop, customer=customer, device=device, assigned_technician=technician,
                                   tracking_code=f'RDTEST{index:08d}', repair_status=index % 5 + 1,
                                   issue_description='اطلاعات صرفاً آزمایشی', final_amount=250000 if index % 2 else None)
    print('Isolated Django API ready at http://127.0.0.1:8001', flush=True)
    with make_server('127.0.0.1', 8001, get_wsgi_application(),
                     server_class=ThreadedTestServer, handler_class=QuietHandler) as server:
        server.serve_forever()
