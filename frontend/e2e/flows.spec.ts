import { test, expect, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
const api = 'http://127.0.0.1:8001/api'
const runtimeErrors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`${response.status()}: ${response.url()}`)
  })
})
test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page), 'No uncaught browser errors or server failures').toEqual([])
})
async function login(page: Page, username = 'qa_manager') {
  await page.goto('/login')
  await page.getByLabel('نام کاربری').fill(username)
  await page.getByLabel('رمز عبور', { exact: true }).fill('Isolated-Test-Only!4729')
  const response = page.waitForResponse(
    (response) => response.url() === `${api}/token/` && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'ورود به پنل' }).click()
  const tokens = (await (await response).json()) as { access: string; refresh: string }
  await expect(page.getByRole('button', { name: 'خروج از حساب' })).toBeVisible()
  return tokens
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
}
test('صفحه عمومی، کاهش حرکت، اعتبارسنجی و صفحه ۴۰۴', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'تعمیر دقیق. خیالِ آسوده.' })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  await noOverflow(page)
  await mkdir('test-results/visual', { recursive: true })
  await page.screenshot({
    path: `test-results/visual/landing-${info.project.name}.png`,
    fullPage: true,
  })
  await page.goto('/track')
  await page.getByRole('button', { name: 'پیگیری تعمیر' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.goto('/does-not-exist')
  await expect(page.getByRole('heading', { name: 'این صفحه را پیدا نکردیم' })).toBeVisible()
  expect(errors).toEqual([])
  await page.goto('/login')
  await page.getByLabel('نام کاربری').click()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('رمز عبور', { exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'نمایش رمز', exact: true })).toBeFocused()
})
test('پیگیری عمومی معتبر، کد ناموجود و عدم افشای اطلاعات داخلی', async ({ page }) => {
  await page.goto('/track')
  await page.getByLabel('کد پیگیری سفارش').fill(' rdtest00000000 ')
  const response = page.waitForResponse((response) =>
    response.url().includes('tracking_code=RDTEST00000000'),
  )
  await page.getByRole('button', { name: 'پیگیری تعمیر' }).click()
  const received = await response
  expect(received.status()).toBe(200)
  expect(received.request().headers()).not.toHaveProperty('authorization')
  const payload = await received.json()
  expect(Object.keys(payload).sort()).toEqual(
    [
      'id',
      'tracking_code',
      'repair_status',
      'repair_status_display',
      'final_amount',
      'is_paid',
      'created_at',
    ].sort(),
  )
  await expect(page.getByRole('heading', { name: 'پذیرش اولیه' })).toBeVisible()
  await expect(page.getByText('مشتری آزمایشی', { exact: true })).toHaveCount(0)
  await page.getByLabel('کد پیگیری سفارش').fill('RDNOTFOUND1234')
  await page.getByRole('button', { name: 'پیگیری تعمیر' }).click()
  await expect(page.getByRole('heading', { name: 'سفارشی با این کد پیدا نشد' })).toBeVisible()
})

test('اسکرول و چیدمان صفحه پیگیری با ورودی خالی', async ({ page }, info) => {
  const width = info.project.name === 'mobile' ? 280 : info.project.name === 'tablet' ? 768 : 1024
  await page.setViewportSize({ width, height: 620 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const lookups: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('tracking_code=')) lookups.push(request.url())
  })
  await page.goto('/track')
  await expect(page.getByLabel('کد پیگیری سفارش')).toHaveValue('')
  await expect(page.locator('.tracking-outcome')).toHaveCount(0)
  const layout = await page.evaluate(() => {
    const hero = document.querySelector('.tracking-hero')!.getBoundingClientRect()
    const help = document.querySelector('.tracking-help')!.getBoundingClientRect()
    const photo = document.querySelector('.tracking-photo')!.getBoundingClientRect()
    return { documentWidth: document.documentElement.scrollWidth, hero: hero.bottom, help: help.top, photo: photo.top }
  })
  expect(layout.documentWidth).toBeLessThanOrEqual(width)
  expect(layout.help - layout.hero).toBeLessThanOrEqual(16)
  if (width <= 840) expect(layout.photo).toBeGreaterThan(layout.help)

  await page.getByRole('button', { name: 'پیگیری تعمیر' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(lookups).toEqual([])
  await noOverflow(page)

  await page.mouse.move(width / 2, 420)
  await page.mouse.wheel(0, 2000)
  await expect(page.locator('.footer-bottom')).toBeInViewport()
  await page.mouse.wheel(0, -2000)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test('لینک پیامکی، حفظ محرمانگی کد و بازیابی خطای پیگیری', async ({ page }) => {
  const lookup = page.waitForRequest((request) => request.url() === `${api}/repairs/?tracking_code=RDTEST00000004`)
  await page.goto('/track?code=rdtest00000004')
  const incoming = await lookup
  expect(incoming.headers()).not.toHaveProperty('authorization')
  expect(incoming.headers().referer || '').toBe('')
  await expect(page).toHaveURL(/\/track$/)
  const ready = page.getByRole('heading', { name: 'آماده تحویل' })
  await expect(ready).toBeFocused()
  await expect(page.locator('[aria-current="step"]')).toContainText('آمادهٔ تحویل')
  await noOverflow(page)

  const code = page.getByLabel('کد پیگیری سفارش')
  await code.fill('RDTEST00000002')
  await expect(ready).toHaveCount(0)
  const offline = `${api}/repairs/?tracking_code=RDTEST00000002`
  await page.route(offline, (route) => route.abort('failed'), { times: 1 })
  await page.getByRole('button', { name: 'پیگیری تعمیر' }).click()
  await expect(page.getByRole('alert')).toContainText('دریافت وضعیت سفارش ممکن نشد')
  await page.getByRole('button', { name: 'تلاش دوباره' }).click()
  await expect(page.getByRole('heading', { name: 'منتظر قطعه' })).toBeVisible()
  await expect(page.locator('[aria-current="step"]')).toContainText('تعمیر')

  await page.goto('/track?code=BAD-CODE')
  await expect(page).toHaveURL(/\/track$/)
  await expect(page.getByRole('alert')).toContainText('کد پیگیری داخل لینک معتبر نیست')
  await expect(code).toHaveValue('')
})

test('وضعیت لغو و پاسخ نامعتبر در صفحه پیگیری', async ({ page }) => {
  await page.goto('/track')
  const query = `${api}/repairs/?tracking_code=RDTEST00000007`
  await page.route(query, (route) => route.fulfill({ json: {
    tracking_code: 'RDTEST00000007', repair_status: 7,
    final_amount: null, is_paid: false, created_at: '2026-11-23T12:00:00+03:30',
  } }), { times: 1 })
  await page.getByLabel('کد پیگیری سفارش').fill('RDTEST00000007')
  await page.getByRole('button', { name: 'پیگیری تعمیر' }).click()
  await expect(page.getByRole('heading', { name: 'لغوشده' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'مراحل تعمیر' })).toHaveCount(0)
  await noOverflow(page)
  await page.route(query, (route) => route.fulfill({ json: { repair_status: 100 } }), { times: 1 })
  await page.getByRole('button', { name: 'پیگیری تعمیر' }).click()
  await expect(page.getByRole('alert')).toContainText('دریافت وضعیت سفارش ممکن نشد')
  await expect(page.getByRole('heading', { name: 'لغوشده' })).toHaveCount(0)
})

test('محافظت مسیر، داشبورد مدیر، بازیابی JWT و فیلتر و صفحه‌بندی', async ({ page }, info) => {
  const requestedUrls: string[] = []
  page.on('request', (request) => requestedUrls.push(request.url()))
  await page.goto('/app/repairs')
  await expect(page).toHaveURL(/\/login/)
  await login(page)
  await page.goto('/app')
  await expect(page.getByRole('heading', { name: 'جریان سفارش‌ها' })).toBeVisible()
  const refreshed = page.waitForResponse((response) => response.url() === `${api}/token/refresh/`)
  await page.reload()
  expect((await refreshed).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'جریان سفارش‌ها' })).toBeVisible()
  const queue = page.getByRole('region', { name: 'صف کار تعمیرگاه' })
  const waiting = queue.getByRole('button', { name: 'منتظر قطعه' })
  await waiting.click()
  await expect(waiting).toHaveAttribute('aria-pressed', 'true')
  await expect(queue.getByRole('link', { name: 'مشاهده فهرست «منتظر قطعه»' }))
    .toHaveAttribute('href', '/app/repairs?status=3')
  if (info.project.name === 'mobile') {
    const dock = page.getByRole('navigation', { name: 'دسترسی سریع پنل' })
    await expect(dock.getByRole('link', { name: 'خانه' })).toHaveAttribute('aria-current', 'page')
    await expect(dock.getByRole('link', { name: 'پذیرش' })).toBeVisible()
  }
  await noOverflow(page)
  await page.screenshot({
    path: `test-results/visual/dashboard-${info.project.name}.png`,
    fullPage: true,
  })
  await page.goto('/app/repairs')
  await expect(page.getByRole('button', { name: 'صفحه بعد' })).toBeEnabled()
  await page.getByRole('button', { name: 'صفحه بعد' }).click()
  await expect(page).toHaveURL(/page=2/)
  await page.getByLabel('فیلتر وضعیت').selectOption('3')
  await expect(page).toHaveURL(/status=3/)
  await expect(page).not.toHaveURL(/page=2/)
  await page.getByRole('searchbox', { name: 'جست‌وجو' }).fill('RDTEST00000002')
  await expect(page).toHaveURL(/search=RDTEST00000002/)
  await expect(page.getByRole('link', { name: 'RDTEST00000002', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'بازنشانی فیلترها' }).click()
  await expect(page).toHaveURL(/\/app\/repairs$/)
  const quickSearch = page.getByRole('button', { name: 'جست‌وجوی سفارش', exact: true })
  await quickSearch.click()
  await expect(page.getByRole('searchbox', { name: 'عبارت جست‌وجو' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(quickSearch).toBeFocused()
  await page.keyboard.press('Control+k')
  const quickSearchInput = page.getByRole('searchbox', { name: 'عبارت جست‌وجو' })
  await quickSearchInput.fill('RDTEST00000002')
  await quickSearchInput.press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/search=RDTEST00000002/)
  await expect(page.getByRole('link', { name: 'RDTEST00000002', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'خروج از حساب' }).click()
  await expect(page).toHaveURL(/\/login/)
  expect(requestedUrls.some((url) => /three|PhoneScene/i.test(url))).toBe(false)
})
test('ثبت سفارش، گردش وضعیت، دریافت دستگاه، پرداخت و تاریخچه روی Django واقعی', async ({
  page,
  request,
}) => {
  const tokens = await login(page)
  await page.goto('/app/repairs/new')
  await page.getByRole('button', { name: 'ادامه به انتخاب دستگاه' }).click()
  await expect(page.getByText('مشتری را انتخاب کنید.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'مشتری جدید', exact: true }).click()
  await page.getByLabel('نام و نام خانوادگی مشتری').fill('مشتری موقت آزمون')
  await page.getByLabel('شماره موبایل اصلی مشتری', { exact: true }).fill('09120000001')
  await page.getByLabel('شماره در دسترس برای پیامک (اختیاری)').fill('09121112233')
  await page.getByRole('button', { name: 'ادامه به انتخاب دستگاه' }).click()
  await page.getByRole('button', { name: 'نام مدل به‌صورت دستی' }).click()
  await page.getByLabel('نام مدل دستگاه', { exact: true }).fill('Isolated test device')
  await page.getByRole('button', { name: 'ادامه به جزئیات سفارش' }).click()
  await page.getByLabel('شرح مشکل دستگاه').fill('شرح آزمایشی؛ بدون داده واقعی')
  await page.getByLabel('تعمیرکار مسئول (اختیاری)').selectOption({ label: 'خودم (qa_manager)' })
  const amount = page.getByRole('textbox', { name: /^مبلغ نهایی/ })
  await amount.fill('۱۰۰۰۰۰۰')
  await expect(amount).toHaveValue('1,000,000')
  await expect(page.getByText('یک میلیون تومان', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'بازگشت', exact: true }).click()
  await expect(page.getByLabel('نام مدل دستگاه', { exact: true })).toHaveValue('Isolated test device')
  await page.getByRole('button', { name: 'ادامه به جزئیات سفارش' }).click()
  await expect(amount).toHaveValue('1,000,000')
  await noOverflow(page)
  const createdResponse = page.waitForResponse(
    (response) => response.url() === `${api}/repairs/` && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'ثبت و دریافت کد پیگیری' }).click()
  const created = await (await createdResponse).json()
  expect(created.repair_status).toBe(1)
  expect(created.final_amount).toBe(1000000)
  expect(created.assigned_technician.username).toBe('qa_manager')
  expect(created.customer.available_phone_number).toBe('09121112233')
  const notices = await request.get(`${api}/notifications/?repair_order_id=${created.id}`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
  })
  expect(notices.ok()).toBe(true)
  const noticePage = await notices.json()
  expect(noticePage.results).toHaveLength(1)
  expect(noticePage.results[0].recipient).toBe('+989121112233')
  await expect(page).toHaveURL(new RegExp(`/app/repairs/${created.id}$`))
  async function patch(action: () => Promise<unknown>) {
    const response = page.waitForResponse(
      (response) =>
        response.url() === `${api}/repairs/${created.id}/` &&
        response.request().method() === 'PATCH',
    )
    await action()
    const received = await response
    expect(received.status()).toBe(200)
    return { body: received.request().postDataJSON(), data: await received.json() }
  }
  await expect(page.getByRole('button', { name: 'تحویل داده‌شده', exact: true })).toHaveCount(0)
  const inspecting = await patch(() =>
    page.getByRole('button', { name: 'در حال بررسی', exact: true }).click(),
  )
  expect(inspecting.body).toEqual({ repair_status: 2 })
  await page.getByLabel('تعمیرکار مسئول', { exact: true }).selectOption({ label: 'qa_reception' })
  const assigned = await patch(() => page.getByRole('button', { name: 'ذخیره تغییرات' }).click())
  expect(assigned.data.assigned_technician.username).toBe('qa_reception')
  await expect(page.getByRole('heading', { name: 'تاریخچه تغییر وضعیت' })).toBeVisible()
  await expect(page.locator('.history-list li')).toHaveCount(1)
  const newToken = await (
    await request.post(`${api}/token/refresh/`, { data: { refresh: tokens.refresh } })
  ).json()
  const forbidden = await request.patch(`${api}/repairs/${created.id}/`, {
    headers: { Authorization: `Bearer ${newToken.access}` },
    data: { repair_status: 6 },
  })
  expect(forbidden.status()).toBe(400)
  const receipt = await patch(() =>
    page.getByRole('button', { name: 'ثبت زمان فعلی', exact: true }).click(),
  )
  expect(receipt.body).toEqual({ receive_now: true })
  expect(receipt.data.received_at).toBeTruthy()
  await page.getByLabel('ورود دستی تاریخ و ساعت').fill('2020-01-01T12:30')
  const manual = await patch(() => page.getByRole('button', { name: 'ذخیره زمان دستی' }).click())
  expect(Object.keys(manual.body)).toEqual(['received_at'])
  expect(manual.body.received_at).toMatch(/Z$/)
  await expect(amount).toHaveValue('1,000,000')
  await amount.fill('12.50')
  await page.getByRole('button', { name: 'ذخیره تغییرات' }).click()
  await expect(page.getByText('مبلغ باید عدد صحیح و نامنفی باشد.', { exact: true })).toBeVisible()
  await amount.fill('1250000')
  await expect(amount).toHaveValue('1,250,000')
  await expect(page.getByText('یک میلیون و دویست و پنجاه هزار تومان', { exact: true })).toBeVisible()
  await page.getByLabel('پرداخت حضوری انجام شده است').check()
  await page.getByRole('button', { name: 'ذخیره تغییرات' }).click()
  const paid = await patch(() => page.getByRole('button', { name: 'تأیید و ذخیره' }).click())
  expect(paid.data.is_paid).toBe(true)
  expect(paid.body.final_amount).toBe(1250000)
  expect(paid.data.paid_at).toBeTruthy()
  expect(paid.body).not.toHaveProperty('paid_at')
  expect(paid.body).not.toHaveProperty('repair_status')
  await page.getByLabel('پرداخت حضوری انجام شده است').uncheck()
  await page.getByRole('button', { name: 'ذخیره تغییرات' }).click()
  const unpaid = await patch(() => page.getByRole('button', { name: 'تأیید و ذخیره' }).click())
  expect(unpaid.data.paid_at).toBeNull()
  await patch(() => page.getByRole('button', { name: 'در حال تعمیر', exact: true }).click())
  await patch(() => page.getByRole('button', { name: 'آماده تحویل', exact: true }).click())
  await page.getByRole('button', { name: 'تحویل داده‌شده', exact: true }).click()
  await patch(() => page.getByRole('button', { name: 'تأیید تغییر وضعیت' }).click())
  await expect(page.getByText('این وضعیت نهایی است و تغییر وضعیت مجاز نیست.')).toBeVisible()
  await page.getByRole('link', { name: 'مشاهده پیگیری عمومی' }).click()
  await expect(page.getByRole('heading', { name: 'تحویل داده‌شده' })).toBeVisible()
  await noOverflow(page)
})
test('مشتریان، دستگاه‌ها و مدیریت کارکنان', async ({ page }) => {
  await login(page)
  await page.goto('/app/customers')
  await page.getByRole('link', { name: 'مشتری آزمایشی', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'دستگاه‌های مشتری' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'سابقه تعمیرها' })).toBeVisible()
  await page.getByRole('button', { name: 'دستگاه جدید', exact: true }).click()
  await page.getByRole('button', { name: 'نام مدل به‌صورت دستی' }).click()
  await page.getByLabel('نام مدل دستگاه').fill(`QA device ${Date.now()}`)
  await page.getByRole('button', { name: 'ثبت دستگاه', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.goto('/app/staff')
  await page.getByRole('button', { name: 'کارمند جدید' }).click()
  const username = `qa_created_${Date.now()}`
  await page.getByLabel('نام کاربری').fill(username)
  await page.getByLabel('رمز عبور', { exact: true }).fill('Isolated-Staff-Only!5832')
  await page.getByRole('button', { name: 'ذخیره اطلاعات' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: `ویرایش ${username}` }).click()
  await page.getByLabel('حساب فعال باشد').uncheck()
  const patched = page.waitForResponse(
    (response) => response.url().includes('/accounts/') && response.request().method() === 'PATCH',
  )
  await page.getByRole('button', { name: 'ذخیره اطلاعات' }).click()
  const response = await patched
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).not.toHaveProperty('new_password')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
test('ناوبری و دسترسی پذیرش و تعمیرکار', async ({ page }, info) => {
  await login(page, 'qa_reception')
  await page.goto('/app/staff')
  await expect(page.getByRole('heading', { name: 'کارکنان تعمیرگاه' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'کارمند جدید' })).toHaveCount(0)
  await page.getByRole('button', { name: 'خروج از حساب' }).click()
  await login(page, 'qa_technician')
  await expect(page.getByRole('heading', { name: 'میز کار qa_technician' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'مبالغ ثبت‌شده پرداخت' })).toHaveCount(0)
  if (info.project.name !== 'desktop') {
    await page.getByRole('button', { name: 'باز کردن منو' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('link', { name: 'مشتریان و دستگاه‌ها' })).toHaveCount(0)
    await page.getByRole('button', { name: 'بستن', exact: true }).click()
  }
  await page.goto('/app/customers')
  await expect(page.getByRole('heading', { name: 'دسترسی به این صفحه ندارید' })).toBeVisible()
  await page.goto('/app/repairs/new')
  await expect(page.getByRole('heading', { name: 'دسترسی به این صفحه ندارید' })).toBeVisible()
  await page.goto('/app/repairs')
  await expect(page.getByLabel('فیلتر مسئول تعمیر')).toHaveCount(0)
  await noOverflow(page)
})

test('تعمیرکار سفارش بدون مسئول را به نام خودش ثبت می‌کند', async ({ page, request }) => {
  const tokens = await login(page)
  const device = `دستگاه بدون مسئول ${Date.now()}`
  const created = await request.post(`${api}/repairs/`, {
    headers: { Authorization: `Bearer ${tokens.access}` },
    data: { customer_id: 1, new_device: { custom_model_name: device } },
  })
  expect(created.status()).toBe(201)
  const { id } = await created.json()
  await page.getByRole('button', { name: 'خروج از حساب' }).click()
  await login(page, 'qa_technician')
  await page.getByRole('link', { name: 'سفارش‌های بدون مسئول' }).click()
  const row = page.getByRole('listitem').filter({ hasText: device })
  await expect(row).toBeVisible()
  await noOverflow(page)
  const claimed = page.waitForResponse((response) => response.url() === `${api}/repairs/${id}/claim/`)
  await row.getByRole('button', { name: 'پذیرش مسئولیت' }).click()
  expect((await claimed).status()).toBe(204)
  await expect(page).toHaveURL(new RegExp(`/app/repairs/${id}$`))
  await expect(page.getByRole('heading', { name: device })).toBeVisible()
  await expect(page.getByText('qa_technician', { exact: true })).not.toHaveCount(0)
})

test('انقضای واقعی access و پاک‌شدن نشست با refresh نامعتبر', async ({ page }) => {
  await login(page)
  await expect(page.getByRole('heading', { name: 'جریان سفارش‌ها' })).toBeVisible()
  // The isolated Django access lifetime is eight seconds. Keep the page loaded
  // so this exercises the actual 401 retry, not refresh-on-reload.
  await page.waitForTimeout(9_000)
  const refreshResponse = page.waitForResponse(
    (response) => response.url() === `${api}/token/refresh/`,
  )
  const unauthorized = page.waitForResponse(
    (response) => response.url().includes('/repairs/') && response.status() === 401,
  )
  await page.getByRole('link', { name: 'همه سفارش‌ها', exact: true }).click()
  await unauthorized
  expect((await refreshResponse).status()).toBe(200)
  await expect(page.getByRole('heading', { name: 'سفارش‌های تعمیر' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'صفحه بعد' })).toBeEnabled()
  await page.evaluate(() =>
    sessionStorage.setItem('repairdesk.refresh', 'invalid-disposable-test-token'),
  )
  await page.reload()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('نشست شما پایان یافته است. لطفاً دوباره وارد شوید.')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('repairdesk.refresh'))).toBeNull()
})

test('مشتری موجود، مدل جست‌وجوشده و دستگاه موجود در ثبت سفارش', async ({ page }) => {
  await login(page)
  await page.goto('/app/repairs/new')
  await page
    .getByLabel('انتخاب مشتری', { exact: true })
    .selectOption({ label: 'مشتری آزمایشی — 09120000000' })
  await page.getByRole('button', { name: 'ادامه به انتخاب دستگاه' }).click()
  await page
    .getByLabel('دستگاه مشتری', { exact: true })
    .selectOption({ label: 'Test Brand Test Phone' })
  await page.getByRole('button', { name: 'ادامه به جزئیات سفارش' }).click()
  const existingResponse = page.waitForResponse(
    (response) => response.url() === `${api}/repairs/` && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'ثبت و دریافت کد پیگیری' }).click()
  const existing = await existingResponse
  expect(existing.status()).toBe(201)
  expect(existing.request().postDataJSON()).toMatchObject({ customer_id: 1, device_id: 1 })
  expect(existing.request().postDataJSON()).not.toHaveProperty('new_customer')
  await expect(page).toHaveURL(/\/app\/repairs\/\d+$/)
  await page.goto('/app/repairs/new')
  await page
    .getByLabel('انتخاب مشتری', { exact: true })
    .selectOption({ label: 'مشتری آزمایشی — 09120000000' })
  await page.getByRole('button', { name: 'ادامه به انتخاب دستگاه' }).click()
  await page.getByRole('button', { name: 'دستگاه جدید', exact: true }).click()
  const searched = page.waitForResponse((response) =>
    response.url().includes('devices/models/?search=Test'),
  )
  await page.getByLabel('جست‌وجوی مدل', { exact: true }).fill('Test')
  expect((await searched).status()).toBe(200)
  await page
    .getByLabel('مدل دستگاه', { exact: true })
    .selectOption({ label: 'Test Brand — Test Phone' })
  await page.getByRole('button', { name: 'ادامه به جزئیات سفارش' }).click()
  const modelResponse = page.waitForResponse(
    (response) => response.url() === `${api}/repairs/` && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'ثبت و دریافت کد پیگیری' }).click()
  const model = await modelResponse
  expect(model.status()).toBe(201)
  expect(model.request().postDataJSON()).toMatchObject({
    customer_id: 1,
    new_device: { device_model: 1 },
  })
  expect(model.request().postDataJSON()).not.toHaveProperty('device_id')
  await expect(page).toHaveURL(/\/app\/repairs\/\d+$/)
})
