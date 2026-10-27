import path from 'node:path'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  workers: 1,
  retries: 0,
  forbidOnly: true,
  reporter: 'line',
  outputDir: '../../test-results/movimientos',
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    reducedMotion: 'reduce',
    colorScheme: 'light',
    launchOptions: {
      executablePath: process.env.FORMS_CHROMIUM_PATH,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    cwd: path.resolve(__dirname, '../..'),
    command:
      'node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/ui-exploration/movimientos-ux-a',
    timeout: 180000,
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture',
      NEXT_FONT_GOOGLE_MOCKED_RESPONSES:
        process.cwd() + '/e2e/forms/fonts/mocked-responses.cjs',
    },
  },
  projects: [{ name: '390', use: { viewport: { width: 390, height: 844 } } }],
})
