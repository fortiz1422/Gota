import { defineConfig } from '@playwright/test'

// Baselines are created and compared only in
// mcr.microsoft.com/playwright:v1.64.1-jammy (same @playwright/test version).
// Run e2e/landing/run-in-docker.sh. Chromium headless, es-AR, UTC.
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: 'line',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      scale: 'device',
      threshold: 0.2,
      maxDiffPixelRatio: 0.002,
      pathTemplate: '{testDir}/__screenshots__{/projectName}/{arg}{ext}',
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    headless: true,
    locale: 'es-AR',
    timezoneId: 'UTC',
    reducedMotion: 'reduce',
    colorScheme: 'light',
    launchOptions: {
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: 'node serve.mjs',
    url: 'http://127.0.0.1:4173/health',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: '320',
      use: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2 },
    },
    {
      name: '390',
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
    },
    {
      name: '1440',
      use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    },
  ],
})
