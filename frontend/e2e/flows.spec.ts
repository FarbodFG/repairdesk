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
  await page.getByRole('button', { name: 'مشتری جدید', exact: true }).click()
  await page.getByLabel('نام و نام خانوادگی مشتری').fill('مشتری موقت آزمون')
  await page.getByLabel('شماره موبایل', { exact: true }).fill('09120000001')
  await page.getByRole('button', { name: 'نام مدل به‌صورت دستی' }).click()
  await page.getByLabel('نام مدل دستگاه', { exact: true }).fill('Isolated test device')
  await page.getByLabel('شرح مشکل دستگاه').fill('شرح آزمایشی؛ بدون داده واقعی')
  await page.getByLabel('تعمیرکار مسئول (اختیاری)').selectOption({ label: 'qa_technician' })
  const createdResponse = page.waitForResponse(
    (response) => response.url() === `${api}/repairs/` && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'ثبت و دریافت کد پیگیری' }).click()
  const created = await (await createdResponse).json()
  expect(created.repair_status).toBe(1)
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
  await page.getByLabel(/^مبلغ نهایی/).fill('1250000')
  await page.getByLabel('پرداخت حضوری انجام شده است').check()
  await page.getByRole('button', { name: 'ذخیره تغییرات' }).click()
  const paid = await patch(() => page.getByRole('button', { name: 'تأیید و ذخیره' }).click())
  expect(paid.data.is_paid).toBe(true)
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
  await expect(page.getByLabel('فیلتر تعمیرکار')).toHaveCount(0)
  await noOverflow(page)
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
  await page
    .getByLabel('دستگاه مشتری', { exact: true })
    .selectOption({ label: 'Test Brand Test Phone' })
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
  await page.getByRole('button', { name: 'دستگاه جدید', exact: true }).click()
  const searched = page.waitForResponse((response) =>
    response.url().includes('devices/models/?search=Test'),
  )
  await page.getByLabel('جست‌وجوی مدل', { exact: true }).fill('Test')
  expect((await searched).status()).toBe(200)
  await page
    .getByLabel('مدل دستگاه', { exact: true })
    .selectOption({ label: 'Test Brand — Test Phone' })
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
