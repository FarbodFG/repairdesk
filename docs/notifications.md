# راه‌اندازی سیستم اعلان RepairDesk

این سیستم از الگوی Outbox استفاده می‌کند: ساخت یا تغییر وضعیت سفارش فقط یک رکورد اعلان را داخل همان تراکنش دیتابیس می‌سازد و ارسال واقعی را worker انجام می‌دهد. بنابراین قطع بودن پنل پیامکی باعث از بین رفتن سفارش یا اعلان نمی‌شود.

## حالت توسعه بدون پنل پیامکی

این پروژه عمداً فایل `.env` را خودکار بارگذاری نمی‌کند؛ `.env.example` فقط فهرست نمونه‌ی متغیرهاست. متغیرها باید در محیط همان process که Django یا worker را اجرا می‌کند تعریف شوند. برای نمونه در PowerShell فعلی:

```powershell
$env:NOTIFICATION_PROVIDER = 'fake'
$env:NOTIFICATION_SEND_MODE = 'auto'
$env:PUBLIC_TRACKING_BASE_URL = 'http://localhost:5173/track'
```

این مقادیر فقط تا بسته‌شدن همان پنجره باقی می‌مانند. در سرور باید آن‌ها را در تنظیمات سرویس، container، CI/CD یا حساب کاربری اجرای Task Scheduler تعریف کنید؛ صرفاً کپی‌کردن `.env.example` به `.env` اثری ندارد.

متغیرها را روی مقادیر زیر نگه دارید:

```env
NOTIFICATION_PROVIDER=fake
NOTIFICATION_SEND_MODE=auto
PUBLIC_TRACKING_BASE_URL=http://localhost:5173/track
```

Fake provider هیچ درخواست اینترنتی نمی‌فرستد و اعلان را با وضعیت `simulated` ثبت می‌کند. این حالت برای توسعه و نمایش کامل رابط کاربری مناسب است.

## راه‌اندازی SMS.ir

ابتدا در پنل SMS.ir برای هر چهار رویداد قالب جدا بسازید. نام پارامترهای قالب‌ها باید با `NAME`، `CODE` و `LINK` هماهنگ باشد. سپس این متغیرها را در محیط سرور تعریف کنید؛ فایل `.env` واقعی را commit نکنید:

```env
NOTIFICATION_PROVIDER=smsir
NOTIFICATION_SEND_MODE=auto
PUBLIC_TRACKING_BASE_URL=https://example.com/track
SMSIR_API_KEY=replace-with-real-secret
SMSIR_TEMPLATE_REPAIR_CREATED=100001
SMSIR_TEMPLATE_REPAIR_WAITING_FOR_PARTS=100002
SMSIR_TEMPLATE_REPAIR_READY=100003
SMSIR_TEMPLATE_REPAIR_CANCELLED=100004
```

قبل از اجرا تنظیمات را بررسی کنید:

```powershell
.\.venv\Scripts\python.exe manage.py check
```

سپس migrationهای دیتابیس را اعمال کنید:

```powershell
.\.venv\Scripts\python.exe manage.py migrate
```

کلید API فقط باید در متغیر محیطی سرور قرار بگیرد. آن را در Git، لاگ یا پاسخ API ذخیره نکنید. پس از افشای احتمالی نیز کلید را از پنل باطل و جایگزین کنید.

## راه‌اندازی کاوه‌نگار

در پنل کاوه‌نگار چهار قالب خدماتی Lookup بسازید. نام قالب باید انگلیسی و بدون فاصله یا `_` باشد. در متن هر قالب `%token` کد رهگیری و `%token10` نام مشتری است. لینک ثابت سایت را داخل خود قالب بنویسید؛ برای نمونه:

```text
%token10 عزیز، سفارش شما آماده تحویل است.
پیگیری: https://example.com/track?code=%token
```

سپس تنظیمات محیطی را تعریف کنید:

```env
NOTIFICATION_PROVIDER=kavenegar
NOTIFICATION_SEND_MODE=auto
PUBLIC_TRACKING_BASE_URL=https://example.com/track
KAVENEGAR_API_KEY=replace-with-real-secret
KAVENEGAR_TEMPLATE_REPAIR_CREATED=RepairCreated
KAVENEGAR_TEMPLATE_REPAIR_WAITING_FOR_PARTS=RepairWaiting
KAVENEGAR_TEMPLATE_REPAIR_READY=RepairReady
KAVENEGAR_TEMPLATE_REPAIR_CANCELLED=RepairCancelled
```

این adapter از API رسمی `verify/lookup.json` استفاده می‌کند و بنابراین سرویس پیشرفته و تأیید قالب‌ها در پنل لازم است.

## اجرای worker

فرمان زیر حداکثر ۱۰۰ اعلان آماده را پردازش می‌کند و سپس خارج می‌شود:

```powershell
.\.venv\Scripts\python.exe manage.py process_notifications --limit 100
```

در ویندوز این فرمان را با Task Scheduler هر یک دقیقه اجرا کنید. گزینه «اجرای نمونه جدید هنگام فعال بودن نمونه قبلی» را روی جلوگیری از اجرای هم‌زمان بگذارید. در لینوکس می‌توان همین فرمان را هر دقیقه با cron یا timer سرویس اجرا کرد. خود پردازشگر نیز claim اتمیک، بازیابی رکوردهای گیرکرده و محافظ attempt دارد.

برای provider واقعی از `auto` یا `worker` استفاده کنید تا درخواست HTTP کاربر منتظر پنل پیامکی نماند. حالت `sync` فقط برای عیب‌یابی محلی است.

## retry و بازیابی

مقادیر پیش‌فرض چهار تلاش با فاصله‌های ۶۰، ۳۰۰ و ۹۰۰ ثانیه است. خطاهای موقت مانند timeout یا پاسخ 429/5xx دوباره تلاش می‌شوند؛ خطاهای دائمی مانند کلید یا قالب نامعتبر تا اصلاح تنظیمات و retry دستی متوقف می‌مانند.

```env
NOTIFICATION_PROCESSING_TIMEOUT_SECONDS=300
NOTIFICATION_MAX_ATTEMPTS=4
NOTIFICATION_RETRY_DELAYS_SECONDS=60,300,900
```

صفحه اعلان‌های داشبورد برای مدیر و پذیرش، وضعیت صف و خطا را نشان می‌دهد و retry دستی را فراهم می‌کند.
