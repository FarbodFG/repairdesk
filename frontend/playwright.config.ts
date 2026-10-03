import { defineConfig } from '@playwright/test'
import { existsSync } from 'node:fs'
const installedChrome =
  process.platform === 'win32' &&
  existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')
const python =
  process.env.E2E_PYTHON ||
  (process.platform === 'win32' ? '../.venv/Scripts/python.exe' : '../.venv/bin/python')
export default defineConfig({
  testDir: './e2e',
  testIgnore: '**/*.live.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    browserName: 'chromium',
    channel: process.env.E2E_BROWSER_CHANNEL || (installedChrome ? 'chrome' : undefined),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: [
    {
      command: `"${python}" e2e/backend_server.py --isolated`,
      url: 'http://127.0.0.1:8001/api/repairs/',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm dev --port 5174 --mode e2e',
      url: 'http://127.0.0.1:5174',
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:8001/api' },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
