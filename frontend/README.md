# فرانت‌اند RepairDesk

رابط فارسی و RTL برای معرفی تعمیرگاه، پیگیری عمومی و فضای کاری مدیر، پذیرش و تعمیرکار. کد محصول مستقیماً API همین Django را فراخوانی می‌کند؛ داده نمایشی یا پاسخ mock در محصول وجود ندارد.

## اجرای محلی

Node.js نسخه 22.15 یا بالاتر در شاخه 22، یا Node 24 به بالا، و pnpm 11 لازم است. نسخه‌های دقیق در `package.json` و `pnpm-lock.yaml` ثبت شده‌اند.

```powershell
cd frontend
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

نشانی: **http://127.0.0.1:5173**. بک‌اند را در ترمینال دیگری، مطابق تنظیمات فعلی پروژه روی پورت 8000 اجرا کنید. این فرانت‌اند دیتابیس اصلی را migration یا seed نمی‌کند و حساب کارمند نمی‌سازد.

`VITE_API_BASE_URL` در `.env.local` باید به ریشه API اشاره کند؛ slash پایانی اختیاری است. اگر مقدار تنظیم نشده باشد، مسیر نسبی `/api` استفاده می‌شود و proxy توسعه آن را به 127.0.0.1:8000 می‌فرستد. در production مسیر `/api` را با reverse proxy به Django متصل کنید یا متغیر محیطی را پیش از build تعیین کنید. برای تغییر متغیرهای Vite، سرور توسعه را دوباره اجرا کنید.

رجیستری پیش‌فرض npm در محیط این کار پاسخ پایدار نداشت؛ نصب با رجیستری عمومی Yarn و بررسی integrity/سیاست‌های pnpm انجام شد. رجیستری و cache محلی در `pnpm-workspace.yaml` متمرکزند و در محیطی با دسترسی عادی قابل تغییرند. تنها package manager پروژه pnpm است.

## بررسی و build

نتیجه ثبت‌شده: Typecheck، Lint، Build، ۲۰ تست واحد/کامپوننت و ۲۴ تست مرورگر موفق. جزئیات، تصاویر تولیدی، حجم bundle و محدودیت‌ها در [گزارش QA](docs/qa-results.md) آمده‌اند.

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm preview
pnpm test:e2e
```

خروجی production در `dist/` ساخته می‌شود. سرور استقرار باید مسیرهای SPA مثل `/app/repairs/12` را به `index.html` برگرداند؛ مسیر `/api` نباید به HTML فرانت‌اند fallback شود. `preview` فقط برای بررسی خروجی است، نه میزبانی production.

## آزمون E2E با بک‌اند واقعی و دیتابیس موقت

`pnpm test:e2e` همان کد Django را با SQLite موقت، تنظیمات ایزوله و داده‌های صریحاً آزمایشی اجرا می‌کند. API روی 8001 و Vite تست روی 5174 هستند؛ تست‌ها هیچ درخواستی به دیتابیس اصلی نمی‌فرستند. migrationها فقط روی دیتابیس موقت اعمال می‌شوند. حساب‌ها و رمزهای داخل فایل fixture صرفاً برای این سرور محلی موقت‌اند؛ هرگز آن را روی شبکه یا production اجرا نکنید.

پیش‌نیاز: `.venv` بک‌اند و dependencyهای آن آماده باشند. اگر Python دیگری دارید، `E2E_PYTHON` را تنظیم کنید. Chrome نصب‌شده در مسیر استاندارد ویندوز به‌طور خودکار استفاده می‌شود؛ در سایر محیط‌ها:

```powershell
pnpm exec playwright install chromium
```

می‌توانید `E2E_BROWSER_CHANNEL=chrome` یا `msedge` تنظیم کنید. در محیط این کار دانلود Chrome for Testing با پاسخ محدودیت منطقه‌ای سرویس مواجه شد؛ آزمون‌ها از مرورگر ازقبل‌نصب‌شده استفاده می‌کنند.

تست‌ها در اندازه‌های 1440، 768 و 390 اجرا می‌شوند و ورود، refresh، نقش‌ها، پیگیری، فیلتر/صفحه‌بندی، ثبت سفارش، تغییر وضعیت، رد transition غیرمجاز، دریافت دستی/فعلی، پرداخت، history، مشتری و کارکنان را بررسی می‌کنند. تصاویر در `test-results/visual/` و گزارش در `playwright-report/` هستند و commit نمی‌شوند.

تست انقضا عمداً ۹ ثانیه صبر می‌کند تا access هشت‌ثانیه‌ای محیط موقت واقعاً منقضی شود. ثبت سفارش با مشتری/دستگاه موجود و مدل جست‌وجوشده نیز پوشش دارد. سرور تست برای درخواست‌های هم‌زمان و preconnect مرورگر thread دارد. cache حالت `e2e` از توسعه جداست و cache پکیج‌ها و گزارش تست از watcher توسعه حذف شده‌اند.

تست اختیاری محیط اصلی فقط ورود و خروج را بررسی می‌کند و داده تجاری تغییر نمی‌دهد:

```powershell
# E2E_USERNAME / E2E_PASSWORD را فقط در محیط ترمینال تنظیم کنید؛ داخل repository ننویسید.
pnpm test:live
```

بدون credential واقعی، این تست skip می‌شود. اجرای موفق تست ایزوله به معنی بررسی تنظیمات MySQL، CORS و داده‌های production نیست.

## معماری

```text
src/
  app/                  providers، route splitting و error boundary
  components/layout/    پوسته عمومی، پوسته پنل، برند و عنوان صفحه
  components/ui/        فرم، dialog، toast، pagination و وضعیت‌های مشترک
  config/               اطلاعات تعمیرگاه، رنگ وضعیت، نقش و transition
  features/
    auth/               ورود، حساب فعلی و guardها
    landing/            صفحه معرفی و نمای سه‌بعدی اختیاری
    tracking/           پیگیری عمومی بدون توکن
    dashboard/          داشبورد مدیریت و میز کار تعمیرکار
    repairs/            لیست، ثبت، جزئیات، پرداخت، history و دریافت دستگاه
    customers/          فهرست، ثبت و پرونده مشتری
    devices/            مدل‌های قابل جست‌وجو و افزودن دستگاه
    staff/              مشاهده، ثبت و ویرایش کارکنان
  hooks/                debounce و media query
  lib/api/              fetch client، refresh mutex، query keys و خطای DRF
  lib/auth/             تنها محل نگهداری token و lifecycle نشست
  lib/animations/       GSAP context و ScrollTrigger با cleanup
  styles/               semantic tokens و سبک‌های عمومی/پنل
  types/                قراردادهای TypeScript
```

TanStack Query تنها مسئول server state است. auth store بسیار کوچک با `useSyncExternalStore` پیاده شده؛ Zustand و کتابخانه HTTP اضافه نیاز نبوده‌اند. فرم‌ها با React Hook Form و Zod و dialogهای قابل‌دسترس با Radix ساخته شده‌اند. تغییرات سفارش invalidation روی سفارش، history، summary و سابقه مشتری انجام می‌دهند. جست‌وجوها debounced و با AbortSignal قابل لغو هستند.

قرارداد کامل: [api-contract.md](docs/api-contract.md). کمبودهای واقعی API و پیشنهاد کوچک اصلاح: [backend-gaps.md](docs/backend-gaps.md).

## امنیت نشست

- Access token فقط در حافظه است. Refresh token فقط در `sessionStorage` همان tab می‌ماند؛ با reload، access تازه دریافت می‌شود. در صورت ممنوع‌بودن storage، نشست فقط در حافظه خواهد بود.
- این روش HttpOnly نیست و در برابر XSS مصونیت ندارد. هیچ token داخل URL، log یا cache پایدار Query نوشته نمی‌شود. از HTML خام یا `dangerouslySetInnerHTML` استفاده نشده است.
- درخواست‌های خصوصی در 401 یک refresh مشترک و حداکثر یک retry دارند؛ refreshهای هم‌زمان تکثیر نمی‌شوند. درخواست دیررس پس از logout نمی‌تواند نشست را زنده کند.
- شکست refresh نشست را پاک می‌کند؛ 403 به‌تنهایی کاربر را logout نمی‌کند. داده‌های Query هنگام خروج پاک می‌شوند. توکن عمومی هرگز به درخواست پیگیری افزوده نمی‌شود، حتی وقتی کارمند وارد شده است.
- بک‌اند logout/blacklist ندارد؛ خروج مرورگر توکن سرقت‌شده را باطل نمی‌کند. برای production، refresh در cookie با HttpOnly/Secure/SameSite و endpoint خروج پیشنهاد شده است و به تغییر بک‌اند نیاز دارد.
- guard و منوی نقش‌محور فقط UX هستند؛ مجوز واقعی همواره در Django کنترل می‌شود.
- پیش از انتشار: HTTPS، CSP مناسب دامنه API، `Referrer-Policy: no-referrer` و `X-Content-Type-Options: nosniff` را در میزبان تنظیم کنید. ابتدا secretهای موجود بک‌اند را از کد خارج و rotate کنید.

## تنظیم اطلاعات تجاری و پول

`src/config/site.ts` تنها محل نام نمایشی، نام تعمیرگاه، شماره، آدرس، ساعت کاری و دسته‌بندی خدمات است. اطلاعات ناموجود placeholder صریح دارند؛ شماره تماس ساختگی، نظر مشتری، آمار یا تضمین ساخته نشده است. دسته‌بندی خدمات باید پیش از انتشار توسط تعمیرگاه تأیید شود.

واحد پول در بک‌اند مشخص نیست. `VITE_CURRENCY_LABEL` را پس از تأیید حسابداری تعمیرگاه روی ریال، تومان یا واحد واقعی تنظیم کنید. هیچ ضرب یا تقسیم خودکار انجام نمی‌شود. عددهای فارسی، جداکننده هزارگان، مقدار صفر و null پشتیبانی می‌شوند؛ مبلغ ورودی از `Number.MAX_SAFE_INTEGER` بیشتر پذیرفته نمی‌شود.

`received_at` زمان دریافت گوشی از مشتری است. «ثبت زمان فعلی» فقط `receive_now:true` می‌فرستد؛ ثبت دستی فقط ISO `received_at`. ورودی تاریخ دستی تقویم میلادی و ساعت محلی دستگاه است و کنار فیلد توضیح داده می‌شود؛ نمایش نهایی با تقویم فارسی و ساعت تهران است. `paid_at` همیشه توسط سرور مدیریت می‌شود.

## طراحی، دسترس‌پذیری و کارایی

- طراحی اختصاصی با زمینه گرم، surface سفید، graphite و teal؛ فونت Vazirmatn variable محلی با font-display swap و subsetهای زبان، بدون وابستگی runtime به Google Fonts.
- RTL در layout، breadcrumb، فیلدها و لیست‌ها؛ کد، تلفن و شناسه‌های لاتین با `bdi` یا LTR.
- label، aria-invalid، شرح خطا، focus visible، skip link، dialog با focus trap، toast زنده و حالت loading/error/empty.
- reduced motion هم در CSS و هم GSAP رعایت می‌شود؛ هیچ محتوایی برای نمایش وابسته به اجرای animation نیست. scroll hijacking وجود ندارد.
- همه صفحه‌ها lazy هستند. Three.js فقط در hero دسکتاپ و درون viewport بارگذاری می‌شود؛ نه در bundle مسیر پنل. DPR حداکثر 1.35 و frameloop از نوع demand است؛ geometry/material در unmount توسط R3F آزاد می‌شوند.
- موبایل، reduced motion، save-data و سخت‌افزار کم‌توان از نمای CSS ثابت استفاده می‌کنند. اندازه hero از ابتدا محفوظ است؛ نبود WebGL با error boundary به نمای ثابت برمی‌گردد.
- نمودار داشبورد فقط داده واقعی summary را نشان می‌دهد؛ روند روزانه یا زمان تکمیل تعمیر ساخته نشده است. میز کار تعمیرکار بر اساس وضعیت‌های فعال، هر گروه با count سرور و لینک صفحه‌بندی کامل ارائه می‌شود.

## انتخاب نسخه‌ها و منابع

نسخه‌ها با metadata رجیستری و peerDependencies بررسی شده‌اند؛ گزارش در `docs/dependencies.json` است. React 19 و R3F 9 همراه‌اند. React Router 7، TypeScript 6.0 و jsdom 26 برای سازگاری با Node نصب‌شده و typescript-eslint انتخاب شده‌اند. Three نسخه 0.185.1 است؛ R3F فعلی هنوز از Clock استفاده می‌کند و در نمای سه‌بعدی یک هشدار deprecation از Three دیده می‌شود. این هشدار پنهان نشده و مانع رندر نیست؛ با ارتقای سازگار R3F باید دوباره بررسی شود.

منابع رسمی بررسی‌شده: [Vite](https://vite.dev/guide/)، [React Router](https://reactrouter.com/start/declarative/installation)، [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)، [Tailwind](https://tailwindcss.com/docs/installation/using-vite)، [React Hook Form resolvers](https://github.com/react-hook-form/resolvers)، [R3F](https://r3f.docs.pmnd.rs/getting-started/introduction)، [GSAP cleanup](https://gsap.com/docs/v3/GSAP/gsap.context()/)، [Fontsource Vazirmatn](https://fontsource.org/fonts/vazirmatn/install).

## محدودیت‌ها

اطلاعات تجاری و واحد پول باید تکمیل شوند. endpoint ویرایش/جزئیات مستقل مشتری، ویرایش دستگاه، فراموشی رمز، logout سرور، تاریخچه عمومی و پرداخت آنلاین وجود ندارند؛ قابلیت ساختگی برای آن‌ها ساخته نشده است. Staff API نام/نام خانوادگی را در لیست نمی‌دهد؛ فرم کارکنان فقط فیلدهای قابل بازیابی را ویرایش می‌کند تا اطلاعات نامعلوم پاک نشوند. محدودیت‌ها و ریسک‌های بک‌اند در سند جدا با خط دقیق ثبت شده‌اند.
