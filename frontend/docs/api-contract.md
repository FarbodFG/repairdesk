# قرارداد واقعی API در RepairDesk

تاریخ تحلیل: ۲۰۲۶/۰۸/۲۹. منبع حقیقت: فایل‌های Python و migrationهای همین repository؛ این سند توصیف رفتار فعلی است، نه قرارداد پیشنهادی.

## محیط و وضعیت اولیه

- Django 5.2.16، DRF 3.17.1، Simple JWT 5.5.1؛ MySQL؛ timezone برابر `Asia/Tehran` و `USE_TZ=True`.
- `python manage.py check` با Python محیط `.venv` اجرا شد: **بدون مسئله**. این بررسی به معنی تست جریان‌ها یا آماده‌بودن دیتابیس نیست.
- از ابتدا `repair_desk/settings.py`، `repair_desk/urls.py` و `requirements.txt` تغییر commit‌نشده داشتند؛ پوشه‌های accounts/api/customers/devices/repairs/shops/utils نیز untracked بودند. هیچ‌کدام توسط فرانت‌اند تغییر نمی‌کنند.
- CORS فقط localhost و 127.0.0.1 روی پورت‌های 5173 و 3000 و مسیر `/api/` را اجازه می‌دهد. `DEBUG=True` و `ALLOWED_HOSTS=[]` تنظیم توسعه هستند.
- همه endpointها زیر `/api/` و دارای slash پایانی هستند. JSON و `Authorization: Bearer <access>` برای کارکنان استفاده می‌شود.

## نقش و سطح دسترسی

| عملیات | مدیر 1 | پذیرش 2 | تعمیرکار 3 | عمومی |
| --- | --- | --- | --- | --- |
| حساب فعلی | بله | بله | بله | خیر |
| خلاصه داشبورد | بله | بله | خیر | خیر |
| لیست سفارش | همان تعمیرگاه | همان تعمیرگاه | فقط تخصیص‌یافته به خودش | فقط یک کد پیگیری |
| ثبت سفارش | بله | بله | خیر | خیر |
| جزئیات، PATCH و تاریخچه سفارش | همان تعمیرگاه | همان تعمیرگاه | فقط سفارش خودش | خیر |
| تخصیص تعمیرکار | بله | بله | فیلد read-only و نادیده گرفته می‌شود | خیر |
| مبلغ، پرداخت، توضیح، زمان دریافت، وضعیت | بله | بله | برای سفارش خودش بله | خیر |
| حذف سفارش بدون تاریخچه | بله | بله | خیر | خیر |
| مشتری، دستگاه مشتری، سابقه مشتری | بله | بله | خیر | خیر |
| مشاهده کارکنان | بله | بله | خیر | خیر |
| ایجاد و ویرایش کارکنان | بله | خیر | خیر | خیر |
| جست‌وجوی مدل دستگاه | بله | بله | بله | خیر |

`is_staff` مجوز پنل محصول نیست؛ `role` معیار است. `role` و `repair_shop` در مدل nullable هستند؛ فرانت‌اند برای حساب ناقص پیام دسترسی نمایش می‌دهد. Backend منبع نهایی authorization باقی می‌ماند.

## انواع پاسخ

```ts
type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] }
type Shop = { id: number; title: string; is_active: boolean; created_at: string }
type Staff = { id: number; username: string; email: string; role: 1|2|3|null;
  role_display: string; repair_shop: Shop|null; is_staff: boolean; is_active: boolean;
  date_joined: string; last_login: string|null }
type Me = { id: number; username: string; first_name: string; last_name: string;
  email: string; role: 1|2|3|null; role_display: string; repair_shop: Shop|null; is_active: boolean }
type Customer = { id: number; name: string; phone_number: string;
  available_phone_number: string; repair_shop: Shop; created_at: string }
type DeviceModel = { id: number; brand: {id:number;name:string}; name: string;
  search_aliases: string; is_active: boolean }
type Device = { id: number; customer: Customer; device_model: DeviceModel|null;
  custom_model_name: string; created_at: string }
type Repair = { id: number; repair_shop: Shop; customer: Customer; device: Device;
  assigned_technician: Staff|null; tracking_code: string; repair_status: 1|2|3|4|5|6|7;
  repair_status_display: string; issue_description: string; final_amount: number|null;
  is_paid: boolean; paid_at: string|null; received_at: string|null; created_at: string }
```

اعداد شناسه و مبلغ در JSON عدد هستند. سقف ذخیره مبلغ در DB از safe integer جاوااسکریپت بیشتر است؛ فرانت‌اند ورود مبلغ را به عدد صحیح امن محدود می‌کند. واحد پول در API تعریف نشده و تنظیم‌پذیر است؛ هیچ تبدیل ریال/تومان انجام نمی‌شود.

## احراز هویت و حساب

| روش و مسیر | درخواست | پاسخ موفق |
| --- | --- | --- |
| POST `token/` | `{username,password}` | 200 `{access,refresh}` |
| POST `token/refresh/` | `{refresh}` | 200 `{access}` |
| POST `token/verify/` | `{token}` | 200 `{}` |
| GET `accounts/me/` | بدون body | 200 `Me` |
| GET `accounts/` | بدون body | 200 `Staff[]`؛ بدون pagination |
| POST `accounts/` | `{username,password,email?,role?,is_active?}` | 201 `Staff` |
| PATCH `accounts/:id/` | `{first_name?,last_name?,username?,email?,role?,is_active?,new_password?}` | 200 فقط فیلدهای serializer ویرایش؛ نه `Staff` کامل |

Access: ۶۰ دقیقه؛ Refresh: ۶۰ روز. rotation و blacklist فعال نشده‌اند و logout سرور وجود ندارد. Password و new_password فقط write-only؛ `id,date_joined,repair_shop,last_login,role_display,is_staff` در ثبت کارمند read-only هستند. نام و نام خانوادگی در پاسخ لیست کارکنان و درخواست ثبت نیستند ولی PATCH آن‌ها را می‌پذیرد. پس فرم ویرایش نام‌های موجود را به اشتباه خالی ارسال نمی‌کند.

اعتبار password از validatorهای Django شامل حداقل ۸ کاراکتر، رمز رایج، تماماً عددی و مشابهت با کاربر می‌آید؛ فراخوانی serializer بدون user، بررسی مشابهت کامل را فراهم نمی‌کند. username حداکثر ۱۵۰، email حداکثر ۲۵۴، first/last name حداکثر ۱۵۰.

## مشتری و دستگاه

| روش و مسیر | ورودی | خروجی |
| --- | --- | --- |
| GET `customers/` | `search` روی name و phone_number | 200 `Customer[]` بدون pagination |
| POST `customers/` | `{name,phone_number,available_phone_number?}` | 201 `Customer` |
| GET `customers/:id/devices/` | بدون body | 200 `Device[]` |
| POST `customers/:id/devices/` | `{device_model?:id|null,custom_model_name?:string}` | 201 `Device` |
| GET `customers/:id/repairs/` | `page,page_size` | 200 `Page<CustomerRepairHistory>` |
| GET `devices/models/` | `search,page,page_size` | 200 `Page<DeviceModel>` |

مشتری: name الزامی حداکثر ۱۰۰؛ تلفن `^09\d{9}$`؛ تلفن دوم خالی مجاز است. repair_shop و created_at و id از سرور می‌آیند. شماره تکراری منع unique ندارد.

دستگاه: دقیقاً یکی از مدل آماده یا نام دستی لازم است؛ نام دستی حداکثر ۱۵۰. مدل آماده در endpoint معمول فقط active است. customer و id و created_at از سرور می‌آیند. نوشتن `device_model` با شناسه، خواندن آن با object تو در تو است.

مدل‌ها بر اساس brand/name مرتب و فقط active هستند؛ search روی name، brand.name و search_aliases اعمال می‌شود. صفحه پیش‌فرض مدل‌ها ۵۰ و سقف ۱۰۰. سابقه مشتری پیش‌فرض ۲۰ و سقف ۱۰۰.

`CustomerRepairHistory` شامل `id,tracking_code,device_name,repair_status,repair_status_display,issue_description,final_amount,is_paid,paid_at,technician_name,created_at` است. endpoint جزئیات مستقل مشتری و PATCH/DELETE مشتری یا دستگاه وجود ندارد؛ صفحه جزئیات از لیست واقعی مشتریان و دو endpoint فرزند استفاده می‌کند.

## سفارش‌ها

### GET `repairs/`

با JWT: `Page<Repair>`، صفحه پیش‌فرض ۲۰ و سقف ۱۰۰. queryها: `page,page_size,search,status,technician_id`. search روی کد، نام مشتری و هر دو شماره؛ status باید عدد معتبر ۱ تا ۷ باشد؛ technician_id باید عدد باشد و فقط برای مدیر/پذیرش اعمال می‌شود. ترتیب `-created_at` و محدودیت تعمیرگاه همیشه برقرار است. تعمیرکار فقط سفارش خودش را می‌بیند. فیلتر active و ordering سفارشی وجود ندارد.

بدون JWT: `tracking_code` الزامی؛ نبودن آن 400 و پیدا نشدن 404. پاسخ یک object عمومی است، نه pagination. حتی اگر کارکنان وارد شده باشند، کلاینت عمومی نباید Authorization بفرستد؛ با JWT این view وارد شاخه لیست کارکنان می‌شود.

پاسخ عمومی فقط: `id,tracking_code,repair_status,repair_status_display,final_amount,is_paid,created_at`. تاریخچه عمومی و timestamp مراحل وجود ندارد. کد جدید با `RD` و ۱۲ کاراکتر از `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` ساخته می‌شود. migration قدیمی کد ده‌کاراکتری داشته و تبدیل داده ندارد؛ UI کد قدیمی الفبایی‌عددی را هم به سرور واگذار می‌کند.

### POST `repairs/`

یکی از `customer_id` یا `new_customer:{name,phone_number,available_phone_number?}` و یکی از `device_id` یا `new_device:{device_model?,custom_model_name?}`. برای مشتری جدید، دستگاه جدید لازم است؛ دستگاه موجود باید متعلق به مشتری انتخاب‌شده باشد. شناسه‌ها با تعمیرگاه محدود می‌شوند.

ورودی‌های اختیاری: `assigned_technician_id` (تعمیرکار فعال همین تعمیرگاه یا null)، `issue_description`، `final_amount` (عدد صحیح نامنفی یا null)، `is_paid` و فعلاً `repair_status`. UI همیشه سفارش جدید را با وضعیت initial می‌سازد. خروجی 201 `Repair`. ساخت مشتری/دستگاه/سفارش در transaction انجام می‌شود.

`customer_id,new_customer,device_id,new_device,assigned_technician_id` write-only هستند. `id,repair_shop,customer,device,tracking_code,repair_status_display,paid_at,received_at,created_at` read-only هستند. فرانت‌اند دو روش مشتری/دستگاه را هم‌زمان ارسال نمی‌کند؛ serializer فعلی تمام تضادها را منع نکرده است.

### GET/PATCH/DELETE `repairs/:id/`

GET: 200 `Repair`. PATCH: `{assigned_technician_id?,repair_status?,final_amount?,is_paid?,issue_description?,received_at?,receive_now?}` و پاسخ 200 `Repair`.

- `received_at` زمان دریافت گوشی از مشتری است، نه شروع تعمیر. ISO datetime یا null مجاز؛ آینده ممنوع.
- `receive_now:true` زمان سرور را ثبت می‌کند؛ با received_at هم‌زمان ممنوع.
- is_paid=true در ثبت یا اولین تغییر، paid_at را خودکار می‌سازد؛ false آن را null می‌کند. paid_at هرگز ورودی UI نیست.
- ارسال همان وضعیت فعلی نیز transition غیرمجاز است؛ در PATCH عادی فیلد وضعیت ارسال نمی‌شود.
- DELETE: اگر تاریخچه وجود داشته باشد 409، در غیر این صورت 200 `{detail}`؛ حتی سفارش بدون تاریخچه را سرور بدون شرط وضعیت حذف می‌کند. UI حذف را به سفارش اولیه بدون تاریخچه محدود می‌کند.

### وضعیت و تاریخچه

| وضعیت | نام | مقصد مجاز |
| --- | --- | --- |
| 1 | پذیرش اولیه | 2،7 |
| 2 | در حال بررسی | 3،4،7 |
| 3 | منتظر قطعه | 4،7 |
| 4 | در حال تعمیر | 3،5،7 |
| 5 | آماده تحویل | 6،7 |
| 6 | تحویل داده‌شده | هیچ |
| 7 | لغوشده | هیچ |

GET `repairs/:id/history/`: آرایه بدون pagination به ترتیب `-modified_at`. هر مورد: `id,repair_previous_status,previous_status_display,repair_new_status,new_status_display,modifier_name,modified_at`. نام و زمان واقعی صرفاً در پنل داخلی نمایش داده می‌شوند. وضعیت اولیه بدون تغییر، تاریخچه ندارد.

## داشبورد

GET `dashboard/summary/`:

```ts
{ orders: {total:number;active:number;ready_for_delivery:number;unpaid:number;today:number};
  revenue: {total_paid_amount:number;today_paid_amount:number};
  status_counts: {initial:number;inspecting:number;waiting_for_parts:number;repairing:number;
    ready_for_delivery:number;delivered:number;cancelled:number} }
```

active وضعیت ۶ و ۷ را ندارد؛ unpaid مبلغ تعیین‌شده و پرداخت‌نشده به‌جز لغوشده است. revenue جمع مبالغ is_paid است، حتی اگر سفارش لغو شده باشد. today با timezone سرور محاسبه می‌شود. نمودار روند روزانه و آمار SLA وجود ندارد و ساخته نمی‌شود.

## خطاها

exception handler اختصاصی وجود ندارد؛ DRF استاندارد: 400 `{field:[message],non_field_errors:[message]}` و nested error برای new_customer/new_device؛ 401/403/404 `{detail:string}`؛ SimpleJWT می‌تواند `code,messages` هم بدهد؛ conflict حذف 409. پاسخ 5xx ممکن است HTML باشد؛ UI متن HTML یا stacktrace را نمایش نمی‌دهد. پیام‌های انگلیسی رایج ترجمه و خطاهای nested با مسیر دقیق کنار فیلد نمایش داده می‌شوند. اعتبارسنجی نهایی همواره با سرور است.

## migrationهای بررسی‌شده

accounts/shops initial؛ customers 0001–0003 (رابطه مدل آماده و نام دستی، تغییر جدول device)؛ devices 0001–0003 (brand/model، active و aliases)؛ repairs 0001–0006 (حذف tracking_token، کد جدید، history، مبلغ و پرداخت، paid_at، حذف assigned_at و افزودن received_at). کد فرانت‌اند فقط schema فعلی را استفاده می‌کند. روی پایگاه اصلی migration اجرا نشده؛ آزمون‌های E2E migrationها را فقط روی SQLite موقت اجرا می‌کنند.
