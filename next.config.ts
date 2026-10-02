import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// Local verification can compile without releasing/uploading source artifacts.
// Runtime instrumentation remains managed by the existing Sentry setup.
const localVerification = process.env.GOTA_LOCAL_VERIFY === 'true'

const nextConfig: NextConfig = {
  serverExternalPackages: ['require-in-the-middle', 'import-in-the-middle', '@prisma/instrumentation'],
  experimental: {
    staleTimes: { dynamic: 0 },
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  ...(localVerification ? { telemetry: false, sourcemaps: { disable: true }, release: { create: false, finalize: false } } : {}),
})
