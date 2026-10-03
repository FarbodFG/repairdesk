import { test, expect } from '@playwright/test'
test('ورود و خروج با حساب محیط واقعی؛ بدون تغییر داده کسب‌وکار', async ({ page }) => {
  test.skip(
    !process.env.E2E_USERNAME || !process.env.E2E_PASSWORD,
    'حساب تست واقعی در متغیرهای محیطی ارائه نشده است.',
  )
  await page.goto('/login')
  await page.getByLabel('نام کاربری').fill(process.env.E2E_USERNAME!)
  await page.getByLabel('رمز عبور', { exact: true }).fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: 'ورود به پنل' }).click()
  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByRole('button', { name: 'خروج از حساب' })).toBeVisible()
  await page.getByRole('button', { name: 'خروج از حساب' }).click()
  await expect(page).toHaveURL(/\/login/)
})
