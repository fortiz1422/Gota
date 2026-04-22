import * as Sentry from '@sentry/nextjs'
import { getSentryOptions } from './lib/observability/sentry'

Sentry.init(
  getSentryOptions(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN),
)
