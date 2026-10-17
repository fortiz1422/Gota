import path from 'node:path'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.', testMatch: '*.spec.ts', workers: 1, retries: 0, forbidOnly: true,
  reporter: 'line', outputDir: './test-results',
  expect: { toHaveScreenshot: { animations: 'disabled', scale: 'css', maxDiffPixelRatio: 0, pathTemplate: '{testDir}/__screenshots__{/projectName}/{arg}{ext}' } },
  use: { baseURL: 'http://127.0.0.1:3100', locale: 'es-AR', timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light', launchOptions: { executablePath: process.env.FORMS_CHROMIUM_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] } },
  webServer: { cwd: path.resolve(__dirname, '../..'), command: 'node e2e/forms/start-server.mjs', url: 'http://127.0.0.1:3100/ui-exploration/forms-baseline/income', timeout: 180000, reuseExistingServer: false, env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture', GOTA_LOCAL_VERIFY: 'true' } },
  projects: [ { name: '320', use: { viewport: { width: 320, height: 568 } } }, { name: '390', use: { viewport: { width: 390, height: 844 } } }, { name: '768', use: { viewport: { width: 768, height: 1024 } } }, { name: '1440', use: { viewport: { width: 1440, height: 900 } } } ],
})
