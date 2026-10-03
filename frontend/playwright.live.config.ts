import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.live.spec.ts',
  outputDir: 'test-results-live',
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    browserName: 'chromium',
    channel: process.env.E2E_BROWSER_CHANNEL || 'chrome',
    screenshot: 'only-on-failure',
  },
})
