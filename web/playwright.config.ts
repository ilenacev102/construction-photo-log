import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke suite: public pages, locale routing, API guard envelopes.
 * Runs against `next dev` with whatever env is present — specs assert
 * shapes and statuses that hold without Supabase credentials.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    // Pin Macedonian: next-intl negotiates locale from Accept-Language,
    // and an untagged browser would render English instead.
    locale: 'mk-MK',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- -p 3100',
    url: 'http://localhost:3100/mk',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
