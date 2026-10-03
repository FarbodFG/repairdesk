# کمبودها و ریسک‌های بک‌اند

بک‌اند در این کار تغییر نکرده است. شماره خط‌ها مربوط به بررسی ۲۰۲۶/۰۸/۲۹ است.

| محل | اثر واقعی | کوچک‌ترین پیشنهاد |
| --- | --- | --- |
| `repair_desk/settings.py:26` و `:93` | secret و credential دیتابیس در کد هستند؛ مقادیر اینجا بازنشر نشده‌اند | انتقال به محیط، چرخش مقادیر فعلی و بررسی history پیش از انتشار |
| `repair_desk/settings.py:29` و `:31` | DEBUG روشن و hostهای production تعریف نشده‌اند | تنظیم محیطی DEBUG/ALLOWED_HOSTS و HTTPS در استقرار |
| `repair_desk/settings.py:152` و `api/urls.py:13` | refresh طولانی بدون blacklist/logout؛ logout مرورگر توکن سرقت‌شده را باطل نمی‌کند | endpoint خروج و blacklist؛ در گام بعد refresh در cookie امن HttpOnly |
| `repairs/views.py:27` و `:136` | پیگیری و لیست روی یک endpoint هستند؛ JWT پاسخ عمومی را به لیست تبدیل می‌کند | endpoint عمومی مستقل؛ فعلاً کلاینت tracking بدون Authorization |
| `repairs/views.py:136` و `api/urls.py:13` | throttle صریح برای پیگیری عمومی و login وجود ندارد | throttle DRF یا محدودسازی در reverse proxy |
| `repairs/models.py:53` و `repairs/views.py:204` | تغییر وضعیت، ثبت history و سایر فیلدهای PATCH یک transaction/lock واحد ندارند؛ درخواست هم‌زمان می‌تواند history ناسازگار ایجاد کند | transaction.atomic و select_for_update روی سفارش، یک بار ذخیره تغییر و history |
| `repairs/serializer.py:61` و `:90` | POST هم مشتری/دستگاه موجود و جدید را می‌پذیرد؛ repair_status قابل نوشتن است و می‌تواند workflow/history را دور بزند | اعتبارسنجی XOR و read-only کردن repair_status در create |
| `repairs/serializer.py:198` و `utils/permissions.py:37` | تعمیرکار مجاز به ویرایش مبلغ، پرداخت و توضیح سفارش خودش است | تصمیم محصولی؛ اگر ناخواسته است، محدودیت field-level در serializer؛ UI فعلاً مطابق مجوز فعلی |
| `repairs/serializer.py:240` | پرداخت بدون مبلغ و تحویل سفارش پرداخت‌نشده در API منع نشده است | در صورت نیاز کسب‌وکار validate ترکیبی؛ UI پرداخت را به مبلغ معتبر وابسته می‌کند، تحویل را مطابق transition واقعی نگه می‌دارد |
| `customers/serializer.py:85` | ثبت سریع دستگاه queryset فعال را مانند DeviceSerializer محدود نمی‌کند | فیلتر active در DeviceQuickCreateSerializer |
| `customers/views.py:20` و `customers/urls.py:5` | GET جزئیات مشتری، PATCH و pagination لیست وجود ندارد | افزودن retrieve و pagination؛ UI فعلاً مشتری را از لیست می‌یابد و ویرایش ساختگی ندارد |
| `accounts/serializer.py:19` و `:43` | لیست و ثبت first/last name ندارند ولی PATCH دارد؛ پاسخ PATCH با Staff متفاوت است | هماهنگ‌کردن فیلدها و پاسخ؛ UI ویرایش بدون ارسال نام‌های نامعلوم |
| `accounts/views.py:36` و `accounts/models.py:21` | حساب roleدار بدون repair_shop می‌تواند به خطای DB یا داده‌های null-shop برسد | permission مشترک عضویت فعال تعمیرگاه و الزام repair_shop برای کارکنان |
| `shops/models.py:8` و `utils/permissions.py:9` | is_active تعمیرگاه در permission بررسی نمی‌شود | افزودن کنترل فعال‌بودن تعمیرگاه به permission مشترک |
| `repairs/views.py:239` | حذف و ایجاد history هم‌زمان می‌تواند به ProtectedError/500 برسد | تراکنش و lock یا تبدیل ProtectedError به 409 |
| `repairs/views.py:41` و `customers/views.py:105` | روابط nested مدل/برند در بعضی querysetها کامل select_related نشده‌اند | تکمیل select_related برای جلوگیری از N+1 |
| `repairs/models.py:81` | واحد پول تعریف نشده؛ عدد 64bit بیش از safe integer JS ظرفیت دارد | واحد پول در تنظیمات فروشگاه و سقف مبلغ یا serialization رشته‌ای برای مقادیر بزرگ |
| `api/views.py:68` | مبلغ paid سفارش لغوشده نیز در revenue حساب می‌شود | تعریف محصولی درآمد خالص/لغو؛ UI عین مقدار سرور را با عنوان «مبالغ ثبت‌شده پرداخت» نشان می‌دهد |
| `customers/views.py:28` | print توسعه هنگام search | حذف print یا logging استاندارد |
| `accounts/tests.py:1` و tests سایر appها | فایل‌های تست فعلاً خالی‌اند | تست permission، isolation تعمیرگاه و transitionها در بک‌اند |

نام تعمیرگاه عمومی، تماس، آدرس، ساعات کاری، خدمات تأییدشده و واحد پول از endpoint عمومی قابل دریافت نیستند. همه در `src/config/site.ts` با placeholder صریح مدیریت می‌شوند؛ آمار، نظر مشتری، تضمین یا اطلاعات تجاری ساختگی اضافه نمی‌شود.
