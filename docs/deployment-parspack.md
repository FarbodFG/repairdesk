# استقرار RepairDesk روی PaaS پارس‌پک

این راهنما برای سه سرویس Django، MySQL و Nginx و یک Worker پیامک است.
خرید سرویس‌ها به معنی اعمال تنظیمات زیر نیست. آدرس‌های مثال را جایگزین کنید.
هیچ رمز یا کلید واقعی را در Git، متغیرهای Build، تصویر یا گفتگو منتشر نکنید.

## ۱. تنظیمات مشترک و دیتابیس

- همهٔ سرویس‌ها در پروژهٔ `repairdesk-prod` و موقعیت یکسان باشند.
- MySQL و Django و Worker عمومی نباشند؛ فقط Nginx ورودی عمومی باشد.
- نام داخلی/Service و پورت MySQL و Django را از پنل بخوانید. نام نمایشی
  الزاماً همان DNS داخلی نیست. `localhost` برای اتصال بین این سرویس‌ها صحیح نیست.
- MySQL: دیتابیس `repairdesk`، کاربر `repairdesk_app`، پورت معمول `3306`،
  فضای ماندگار ۲۰ GB و بکاپ روزانه. آخرین وصلهٔ موجود 8.4 LTS را درخواست کنید.
- اگر قبلاً داده دارید، قبل از migration یک بکاپ قابل‌بازیابی بگیرید. این راهنما
  دیتابیس موجود را reset، flush یا با دادهٔ نمایشی جایگزین نمی‌کند.

## ۲. انتشار کد

فایل‌های این تغییر باید به همان شاخه‌ای برسند که پارس‌پک از آن build می‌کند (`main`).
بعد از بررسی تغییرات، آن‌ها را commit و push کنید. فایل `.env.example` فقط الگوست؛
هیچ `.env` واقعی یا کلید API نباید به ریپو برود. کلیدهای قدیمی داخل تاریخچهٔ Git
برای production قابل استفاده نیستند؛ SECRET_KEY و رمزهای production باید جدید باشند.

در ریشهٔ پروژه، پس از بررسی `git status`، فایل‌های آماده‌شده را منتشر کنید:

```sh
git status --short
git add .env.example .gitignore .dockerignore requirements.txt gunicorn.conf.py repair_desk deploy docs/deployment-parspack.md notifications/management/commands/run_notification_worker.py notifications/test_worker.py
git commit -m "Prepare production deployment"
git push origin main
```

این آماده‌سازی محلی خودش commit یا push انجام نداده است.

## ۳. متغیرهای Runtime سرویس Django

در تب «متغیر محیطی» یا Secrets پنل، از روی `.env.example` این مقادیر را وارد کنید.
فایل `.env` به‌صورت خودکار توسط پروژه خوانده نمی‌شود.

| نام | مقدار |
|---|---|
| `DJANGO_SETTINGS_MODULE` | `repair_desk.production_settings` |
| `DJANGO_DEBUG` | `false`؛ تنظیمات production در هر صورت DEBUG را خاموش می‌کنند |
| `DJANGO_SECRET_KEY` | کلید تصادفی جدید، حداقل ۵۰ کاراکتر، به‌صورت Secret |
| `DJANGO_ALLOWED_HOSTS` | دامنهٔ واقعی سایت و نام داخلی Django، با کاما؛ بدون https و مسیر |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | مثلاً `https://app.yourbrand.ir` |
| `DJANGO_CORS_ALLOWED_ORIGINS` | با ارائهٔ سایت و API از یک دامنه، خالی |
| `DJANGO_TRUST_PROXY` | فقط پس از تأیید پراکسی قابل‌اعتماد و داخلی بودن API، `true` |
| `DJANGO_SECURE_SSL_REDIRECT` | برای استفادهٔ اصلی `true` |
| `DJANGO_MEDIA_ROOT` | `/data/media` |
| `DB_NAME` | `repairdesk` |
| `DB_USER` | `repairdesk_app` |
| `DB_PASSWORD` | رمز همان کاربر، به‌صورت Secret؛ رمز root نباشد |
| `DB_HOST` | DNS داخلی واقعی MySQL از پنل |
| `DB_PORT` | پورت واقعی؛ معمولاً `3306` |
| `PORT` | `8000`؛ پورت Service و Probe هم باید با آن یکسان باشند |
| `WEB_CONCURRENCY` | `2` |
| `GUNICORN_THREADS` | `2` |
| `NOTIFICATION_PROVIDER` | ابتدا `fake` برای بررسی اولیه؛ سپس provider واقعی |
| `NOTIFICATION_SEND_MODE` | `worker` |
| `PUBLIC_TRACKING_BASE_URL` | `https://app.yourbrand.ir/track` |

کلید جدید را می‌توانید در ترمینال امن خود تولید کرده و مستقیماً در Secret پنل کپی کنید:

```sh
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

کلید تولیدشده را اینجا، در screenshot یا ریپو نفرستید. دامنهٔ پیش‌فرض پارس‌پک هم
قابل استفاده است؛ همان دامنهٔ واقعی را در ALLOWED_HOSTS و CSRF و لینک پیگیری بنویسید.

## ۴. ساخت و اجرای Django

- Repository: `https://github.com/FarbodFG/repairdesk.git`، Branch: `main`.
- Python: `3.12`، Context: `/`، App config: `gunicorn.conf.py`.
- نصب بسته‌ها: `pip install -r requirements.txt` (اگر قالب آن را خودکار انجام می‌دهد، تکرار نکنید).
- یک هسته، ۱ GB رم، دیسک `/data` ماندگار؛ کد برنامه را روی این دیسک mount نکنید.
- فرمان اجرا، اگر پنل فیلد جداگانه دارد:

```sh
gunicorn --config gunicorn.conf.py repair_desk.wsgi:application
```

فایل `gunicorn.conf.py` در هر شروع کانتینر، پیش از ایجاد Workerهای وب، فرمان
`collectstatic --noinput` را خودکار اجرا می‌کند. در لاگ باید پیام
`Collecting static files before starting application workers` و نتیجهٔ موفق جمع‌آوری
فایل‌ها را ببینید. شکست این مرحله مانع شروع سرویس با فایل‌های ناقص می‌شود.

این مرحله با متغیرهای Runtime انجام می‌شود؛ SECRET_KEY و رمز DB را به Build منتقل نکنید.
WhiteNoise فایل‌های static پنل مدیریت را بعد از آماده شدن فهرست آن‌ها بارگذاری می‌کند.
دیسک ماندگار یا اشتراک دیسک static بین Nginx و Django لازم نیست؛ فایل‌ها در هر کانتینر
جدید از کد و بسته‌های نصب‌شده دوباره ساخته می‌شوند. اجرای دستی collectstatic بعد از
شروع Workerها جایگزین این مرحله نیست، چون فهرست فایل‌ها در حافظهٔ آن‌ها بارگذاری شده است.

پس از آماده بودن دیتابیس، در ترمینال Django و با همین متغیرهای production اجرا کنید:

```sh
python manage.py check --deploy
python manage.py migrate --plan
python manage.py migrate --noinput
python manage.py createsuperuser
```

Migration را فقط یک بار برای هر release اجرا کنید، نه هم‌زمان در هر Worker.
از `runserver` برای سرویس اصلی استفاده نکنید. HSTS مربوط به subdomain/preload
عمداً فعال نشده و ممکن است check دربارهٔ آن‌ها هشدار دهد؛ نیاز به تأیید TLS همهٔ دامنه‌ها دارد.

Probeها روی HTTP داخلی و همان PORT باشند:

| Probe | مسیر | تأخیر اولیه | Timeout |
|---|---|---:|---:|
| liveness | `/healthz/` | ۳۰ ثانیه | ۳ ثانیه |
| readiness | `/readyz/` | ۱۰ ثانیه | ۵ ثانیه |
| startup | `/healthz/` اگر مسیر قابل تنظیم است | ۳۰ ثانیه | ۵ ثانیه |

Liveness به دیتابیس/پیامک وابسته نیست؛ readiness هنگام قطع دیتابیس 503 می‌دهد.
اگر امکان Host header برای Probe هست، یکی از ALLOWED_HOSTS را قرار دهید.
برای عیب‌یابی موقت بدون TLS می‌توان redirect را خاموش کرد، اما اطلاعات ورود واقعی
را روی HTTP نفرستید و پیش از بهره‌برداری HTTPS و redirect را فعال کنید.

## ۵. React و Nginx

فرانت‌اند باید build شود؛ وصل کردن Git به قالب خام Nginx به‌تنهایی React را build نمی‌کند.
در کامپیوتر/محیط build، برای خروجی همان دامنه:

```sh
cd frontend
pnpm install --frozen-lockfile
pnpm build
```

`VITE_API_BASE_URL=/api` باشد (پیش‌فرض کد هم همین است). اگر واحد پول را در
`VITE_CURRENCY_LABEL` می‌گذارید، واحد واقعی مبالغ ذخیره‌شده را انتخاب کنید؛ این متغیر
مبالغ را تبدیل نمی‌کند. برای تعویض آن مجدداً build کنید. خروجی در `frontend/dist` است.

در سرویس Nginx موجود:

1. فایل `deploy/nginx/default.conf` را آماده کنید؛ `repairdesk-api:8000` را با
   Service و پورت واقعی Django جایگزین کنید.
2. پیکربندی را از روش Config/Secret یا ویرایش config مورد پشتیبانی قالب اعمال کنید؛
   مسیر استاندارد کانتینر Nginx، `/etc/nginx/conf.d/default.conf` است. این فایل
   باید در contextِ http بارگذاری شود، نه داخل یک server دیگر.
3. محتوای dist را با روش بارگذاری/دیسک قالب، در `/usr/share/nginx/html` قرار دهید.
   کپی باید ماندگار باشد یا در هر انتشار تکرار شود. فایل `index.html` باید مستقیم
   در این مسیر باشد، نه داخل یک پوشهٔ dist دیگر.
4. Nginx روی `8080` تنظیم شده؛ پورت Service و Probe آن را هم `8080` کنید.
   اگر قالب پورت دیگری را الزام می‌کند، listen و Service و Probe را یکسان تغییر دهید.
5. دامنه و SSL را روی Nginx تنظیم کنید؛ HTTP به HTTPS در لبهٔ پارس‌پک redirect شود.
   هدر X-Forwarded-Proto باید توسط ingress قابل‌اعتماد بازنویسی شود. API عمومی نباشد.
6. پس از تأیید روش اعمال فایل‌ها، پیکربندی را validate و Nginx را reload/redeploy کنید.
   health آن `/healthz/` است و پاسخ محلی 200 می‌دهد.

جزئیات UI بارگذاری فایل و config بین قالب‌ها فرق دارد؛ پیش از تغییر مسیرهای mount،
ساختار موجود سرویس را ببینید. mount یک دیسک خالی روی مسیر html، فایل‌های داخل
ایمیج را پنهان می‌کند. دیتابیس و دایرکتوری کد Django را دست‌کاری نکنید.

اگر سرویس ساخت Dockerfile از ریپو دارد، `deploy/Dockerfile.web` جایگزین قابل تکرار
برای همین Nginx است؛ Context ریشهٔ ریپو است. این روش سرویس پنجم لازم ندارد.
روی رم ۲۵۶ MB فرانت‌اند را build نکنید؛ build را در محیط جدا انجام دهید یا منابع build
کافی اختصاص دهید. سرویس Nginx فقط خروجی آماده را ارائه می‌کند.

فایل‌های uploads فعلاً عمومی نیستند. افزودن قابلیت upload به طراحی ارائهٔ امن فایل‌ها
هم نیاز دارد؛ WhiteNoise برای ارائهٔ فایل‌های upload نیست.

## ۶. حساب و اطلاعات تعمیرگاه

در `https://YOUR_DOMAIN/admin/` با superuser وارد شوید. یک RepairShop با اطلاعات
واقعی بسازید. برای حسابی که باید از پنل کاری استفاده کند، repair_shop را همان تعمیرگاه
و role را manager قرار دهید (برای کاربران عادی فقط مجوزهای لازم، بدون superuser).
حساب ساخته‌شده با createsuperuser به‌تنهایی لزوماً repair_shop و role ندارد.
برندها و مدل‌های واقعی دستگاه را از admin اضافه یا با فرمان موجود import کنید؛ fixture
و حساب‌های تست را روی محیط اصلی بارگذاری نکنید.

## ۷. Worker و پیامک

ابتدا API، migrationها و ورود را بررسی کنید، سپس Worker را فعال کنید.
Dockerfile: `deploy/Dockerfile.worker`، Context: ریشهٔ همین ریپو.
متغیرهای Runtime مربوط به production، دیتابیس و پیامک را مانند API قرار دهید.
Worker پورت HTTP ندارد؛ برای آن HTTP Probe تعریف نکنید. یک نمونه کافی است.

```sh
python manage.py run_notification_worker --interval 60 --limit 100
```

اگر زمان‌بند قابل‌اعتماد دارید، به‌جای Worker دائم فقط فرمان زیر را هر دقیقه اجرا کنید؛
این دو روش را هم‌زمان فعال نکنید:

```sh
python manage.py process_notifications --limit 100
```

برای فعال‌سازی واقعی، در API و Worker هر دو NOTIFICATION_PROVIDER را به `smsir`
یا `kavenegar` تغییر دهید. کلید و چهار قالب تأییدشدهٔ همان provider را مطابق
`docs/notifications.md` اضافه کنید. حالت fake پیامک واقعی ارسال نمی‌کند.
ابتدا فقط روی شمارهٔ متعلق به خودتان، با ثبت/تغییر وضعیت یک سفارش آزمایشیِ مشخص،
ارسال و وضعیت صف را بررسی کنید. کانتینر generic Docker بدون کد پروژه Worker نیست.

## ۸. بررسی نهایی و بازگشت

- `/healthz/` عمومی Nginx پاسخ 200؛ `/readyz/` داخلی Django پاسخ 200.
- صفحهٔ اصلی، ورود و refresh یک مسیر مثل `/app` باید درست باشند.
- `/api/...` باید JSON API برگرداند، نه index.html؛ خطای API هم نباید SPA شود.
- `/admin/` باید CSS داشته باشد و ورود آن CSRF/redirect loop نداشته باشد.
- ورود، ثبت مشتری/سفارش، پیگیری عمومی و نقش‌ها را با دادهٔ مشخص بررسی کنید.
- قطع موقت پیامک نباید ثبت سفارش را خراب کند؛ وضعیت آن در اعلان‌ها قابل بررسی است.
- ری‌استارت سرویس نباید داده‌های MySQL یا فایل‌های `/data` را حذف کند.
- بکاپ و بازیابی را روی محیط/دیتابیس جدا امتحان کنید، نه با overwrite دادهٔ اصلی.

در خطای build/runtime، بخش مرتبط لاگ را بدون رمز و توکن ارسال کنید. در rollback،
اول نسخهٔ قبلی اپلیکیشن را نگه دارید؛ migration معکوس یا بازگردانی دیتابیس را بدون
بررسی از دست رفتن داده انجام ندهید. این آماده‌سازی جای تست واقعی روی MySQL و
زیرساخت پارس‌پک را نمی‌گیرد.

## نتیجهٔ بررسی محلی در ۲۰۲۶-۱۰-۲۸

- ۷۸ تست بک‌اند روی SQLite موقت، از جمله سلامت سرویس و Worker و تنظیمات production: موفق.
- ۲۰ تست فرانت‌اند و ساخت خروجی production: موفق.
- `check --deploy` با مقادیر آزمایشی بدون اتصال به دیتابیس: بدون خطا، با دو هشدار
  عمدی HSTS subdomains/preload. این بررسی تأیید اتصال MySQL نیست.
- نصب WhiteNoise در کامپیوتر حاضر به خطای شبکهٔ دریافت از PyPI خورد؛ ارائهٔ static
  با middleware در اجرای واقعی هنوز بررسی نشده و نصب requirements در پارس‌پک باید موفق شود.
- Docker Engine محلی فعال نیست؛ ساخت/اجرای ایمیج‌های نمونه و آزمون Nginx انجام نشده است.
- استقرار روی حساب پارس‌پک، migration دیتابیس واقعی و ارسال پیامک واقعی انجام نشده است.

منابع تنظیمات: [چک‌لیست استقرار Django](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/)،
[تنظیمات Gunicorn](https://gunicorn.org/reference/settings/) و
[ارائهٔ static با WhiteNoise](https://whitenoise.readthedocs.io/en/stable/django.html).
