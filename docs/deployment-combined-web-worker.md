# اجرای Django و Worker پیامک در همان سرویس پارس‌پک

این روش سرویس موجود Django را حفظ می‌کند. Supervisor وب و ارسال‌کنندهٔ صف را در همان کانتینر اجرا می‌کند؛ MySQL، Nginx، دامنه، پورت ۸۰۰۰ و Secretهای فعلی دوباره ساخته نمی‌شوند.

## ۱. منابع و وضعیت فعلی

- تعداد نمونه‌های سرویس Django: برای شروع ۱.
- برای شروعِ کم‌ترافیک ۵۱۲ MB رم با یک پردازش وب قابل بررسی است؛ ۱ GB رم و ۵۰۰ میلی‌کور CPU فضای بیشتری برای وب و Worker می‌دهد. اگر سرویس فعلی این منابع یا بیشتر دارد، خرید سرویس دیگر لازم نیست. این پیشنهاد جای اندازه‌گیری مصرف واقعی را نمی‌گیرد.
- با رم محدود `WEB_CONCURRENCY=1` و `GUNICORN_THREADS=2` بگذارید. با منابع کافی، مقدار فعلی پردازش‌های وب می‌تواند حفظ شود؛ تعداد پردازش‌های وب Workerهای اضافی ایجاد نمی‌کند.
- app config همان `gunicorn.conf.py` و Python همان ۳٫۱۲ باقی بماند.

## ۲. انتشار فایل‌های آماده

از ریشهٔ پروژه در PowerShell:

```powershell
git status --short
git add -- requirements.txt gunicorn.conf.py .env.example deploy notifications frontend/src/features/notifications docs/notifications.md docs/deployment-parspack.md docs/notification-worker-review-2026-11-22.md docs/deployment-combined-web-worker.md
git commit -m "Run Django web and SMS worker in one service"
git push origin main
```

این دستورها اصلاحات اخیر صف و صفحهٔ اعلان‌ها را نیز همراه راه‌اندازی مشترک منتشر می‌کنند. فایل‌های خروجی، اسکرین‌شات‌ها و مدارک ارائه همچنان نادیده گرفته می‌شوند. فایل‌های بزرگ `artifacts` را به Git اضافه نکنید.

در پارس‌پک منتظر build جدید بمانید؛ نصب `supervisor==4.3.0` از requirements در build انجام می‌شود. ری‌استارت بدون build، بستهٔ جدید را نصب نمی‌کند. در این مرحله `RUN_SMS_WORKER` غایب یا `false` است و اجرای فعلی وب حفظ می‌شود.

## ۳. فعال‌سازی روی همان سرویس Django

قبل از فعال‌کردن، در صفحهٔ اعلان‌ها صف پیامک‌های واقعیِ در انتظار را مرور کنید. فعال‌شدن Worker رکوردهای معتبرِ آماده را پردازش می‌کند.

در متغیرهای محیطی همان `repairdesk-django-api-django`:

| نام | مقدار |
|---|---|
| `RUN_SMS_WORKER` | `true` |
| `NOTIFICATION_SEND_MODE` | `worker` |
| `NOTIFICATION_PROVIDER` | `smsir` |
| `PUBLIC_TRACKING_BASE_URL` | `https://suncitymobile.ir/track` |
| `SMSIR_TEMPLATE_REPAIR_CREATED` | `836872` |
| `SMSIR_TEMPLATE_REPAIR_WAITING_FOR_PARTS` | `938884` |
| `SMSIR_TEMPLATE_REPAIR_READY` | `691661` |

متغیرهای موجود را ویرایش کنید و تکراری نسازید. `RUN_SMS_WORKER` متغیر جدید است. همهٔ ENVها و Secretهای فعلی، از جمله `SMSIR_API_KEY`، `DJANGO_SECRET_KEY` و `DB_PASSWORD` حفظ شوند؛ هر دو پردازش همان محیط را به ارث می‌برند. `REPAIRDESK_SUPERVISED` یک علامت داخلی است و نباید دستی در پنل وارد شود.

پس از ذخیرهٔ تنظیمات، سرویس Django را از پاورکنترل راه‌اندازی مجدد کنید. Worker جداگانه نسازید و فرمان Worker را در ترمینال دیگری اجرا نکنید.

## ۴. بررسی اجرا

در ترمینال همان سرویس:

```sh
python manage.py check
python deploy/run_combined.py status
```

فرمان اول باید بدون خطا تمام شود. وضعیت فرآیندها پس از چند ثانیه باید شامل این سه مورد باشد:

```text
fatal_exit                RUNNING
repairdesk:sms_worker     RUNNING
repairdesk:web            RUNNING
```

نام `fatal_exit` شنوندهٔ خطای مدیر پردازش است. در لاگ شروع عبارت `Starting combined Django web and SMS worker with Supervisor` دیده می‌شود. پورت و Probeهای وب فعلی را حفظ کنید؛ برخلاف Worker مستقل، این سرویس مشترک هنوز وب‌سرور دارد.

اگر فرمان status گفت Supervisor پیدا نمی‌شود، build جدید نصب نشده است. اگر سوکت در دسترس نیست، RUN_SMS_WORKER و لاگ شروع را بررسی کنید؛ از اجرای دستی یک Supervisor دوم خودداری کنید. اگر تنظیم مهلت توقف در پنل در دسترس است، ۶۰ ثانیه برای پایان درخواست جاری وب و پیامک مناسب‌تر است؛ در توقف اجباری، نتیجهٔ نامشخص نیازمند بررسی پنل پیامکی خواهد بود.

## ۵. آزمون با شمارهٔ خودتان

۱. از پنل کارکنان یک مشتری با شمارهٔ متعلق به خودتان و سفارش آزمایشی بسازید.
۲. دریافت پیامک ثبت سفارش و کارکرد لینک پیگیری را بررسی کنید.
۳. سفارش را از مسیر مجاز به «انتظار برای قطعه» و سپس «آمادهٔ تحویل» ببرید و دریافت پیامک‌ها را بررسی کنید. پس از هر تغییر منتظر پردازش صف بمانید.
۴. نتیجه و خطا را در صفحهٔ اعلان‌ها ببینید. Worker پس از commit سفارش علامت بیدارباش محلی می‌گیرد؛ در صورت نرسیدن آن، بررسی دوره‌ای هر ۵ ثانیه مسیر پشتیبان است. زمان پردازش نوبت جاری و زمان پاسخ پنل/اپراتور جداست و تضمین رسیدن پیامک ظرف ۵ ثانیه وجود ندارد.

اگر شمارهٔ دوم مشتری پر است، همان شماره مقصد پیامک است؛ خالی‌بودن یا برابر بودن آن با شمارهٔ اصلی مجاز است. برای این رفتار و کاهش تأخیر، کد Django و فایل‌های `deploy` جدید را build کنید و خروجی جدید رابط سایت را هم منتشر کنید. ENVها، Secretها و حالت `worker` فعلی حفظ می‌شوند؛ سرویس جدید یا migration لازم نیست.
۵. یک ری‌استارت عادی Django انجام دهید و بررسی کنید وب و `sms_worker` خودکار دوباره RUNNING شوند.

صفحهٔ اعلان‌های جدید، نتیجهٔ نامشخص را با هشدار نشان می‌دهد. برای نصب آن، خروجی فرانت‌اندِ بازبینی ۲۰۲۶-۱۱-۲۲ را نیز مانند انتشارهای قبلی روی Nginx قرار دهید؛ Push بک‌اند به‌تنهایی فایل‌های React سرویس Nginx را عوض نمی‌کند.

## ۶. انتشار صفحهٔ اعلان‌های جدید روی Nginx

بستهٔ آماده روی کامپیوتر: `artifacts/repairdesk-web-2026-11-22-worker-review.tar.gz`.

۱. در ریپوی GitHub، از Releases یک انتشار جدید با tag برابر `sms-worker-2026-11-22` و target برابر `main` بسازید.
۲. همین فایل tar.gz را به‌عنوان دارایی انتشار آپلود و Release را منتشر کنید.
۳. در ترمینال سرویس Nginx این دستورات را اجرا کنید. ابتدا بسته دریافت و هش بررسی می‌شود؛ سپس از نسخهٔ فعلی بکاپ گرفته و فایل‌ها جایگزین می‌شوند:

```sh
set -eu
APP=/usr/share/nginx/html/repairdesk
PKG=/tmp/repairdesk-web-2026-11-22-worker-review.tar.gz
wget -T 60 -O "$PKG" 'https://github.com/FarbodFG/repairdesk/releases/download/sms-worker-2026-11-22/repairdesk-web-2026-11-22-worker-review.tar.gz'
echo "8b2ea2935d09b46366f0e4075d49abcb977cd1a971cdf3b2dd601674fc674a60  $PKG" | sha256sum -c -
test -f "$APP/index.html"
BACKUP="/usr/share/nginx/html/repairdesk-backup-$(date +%Y%m%d-%H%M%S)"
cp -R "$APP" "$BACKUP"
tar -xzf "$PKG" -C "$APP"
echo "Published; backup: $BACKUP"
```

مسیر APP بر اساس مسیر فعالِ گزارش‌شدهٔ همین استقرار است. اگر مسیر root سرویس Nginx را بعداً تغییر داده‌اید، قبل از اجرا مسیر واقعی را جایگزین کنید. نیازی به تغییر nginx.conf یا ری‌استارت Nginx برای جایگزینی این فایل‌های استاتیک نیست. بعد از انتشار صفحهٔ اعلان‌ها را با Ctrl+F5 تازه کنید.

## بازگشت به ارسال مستقیم

در صورت نیاز به بازگشت:

```env
RUN_SMS_WORKER=false
NOTIFICATION_SEND_MODE=sync
```

سپس Django را راه‌اندازی مجدد کنید. صف و سفارش‌ها حذف نمی‌شوند. رکوردهای قدیمی داخل صف با sync خودکار پردازش نمی‌شوند؛ آن‌ها را جداگانه بررسی کنید.

## نحوهٔ کار و محدودیت آزمون

قبل از بازشدن سوکت Gunicorn، در حالت فعال، فرآیند آغازین با Supervisor جایگزین می‌شود. Supervisor دقیقاً یک وب و یک Worker اجرا می‌کند. علامت داخلی مانع ایجاد مدیرهای تودرتو می‌شود. فرآیندها در خطا ری‌استارت می‌شوند؛ شکست تکراری هنگام شروع، باعث توقف مدیر می‌شود تا پلتفرم کانتینر را دوباره راه‌اندازی کند. کنترل Supervisor فقط روی سوکت Unix محلی است و پورت عمومی اضافه‌ای ندارد.

منابع: [پیکربندی Supervisor](https://supervisord.org/configuration.html)، [ترتیب on_starting و ساخت سوکت در Gunicorn](https://github.com/benoitc/gunicorn/blob/master/gunicorn/arbiter.py).

مجموعهٔ **۱۰۲ تست بک‌اند** موفق است. علاوه بر آن، اجرای واقعی Gunicorn 26.2.0 و Supervisor 4.3.0 روی Ubuntu با Python 3.12.3 و بارکاری آزمایشی بررسی شد: پاسخ HTTP، یک ارسال‌کننده با سه پردازش وب، ری‌استارت پس از crash، توقف هماهنگ و خروج مدیر پس از شکست تکراری شروع؛ موفق. این تست در `deploy/verify_combined_linux.py` قابل تکرار است و هیچ پیامک یا دیتابیس اصلی را استفاده نمی‌کند. استقرار واقعی روی پارس‌پک و دریافت پیامک همچنان باید پس از انتشار بررسی شود.
