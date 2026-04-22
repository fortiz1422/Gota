import * as Sentry from '@sentry/nextjs'
import { getSentryOptions } from './lib/observability/sentry'

Sentry.init(getSentryOptions(process.env.NEXT_PUBLIC_SENTRY_DSN))

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
