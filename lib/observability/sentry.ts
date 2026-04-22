import * as Sentry from '@sentry/nextjs'
import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs'

const FILTERED = '[Filtered]'
const TRUNCATED = '[Truncated]'

const SENSITIVE_KEY_PATTERNS = [
  /amount/i,
  /balance/i,
  /description/i,
  /email/i,
  /input/i,
  /monto/i,
  /password/i,
  /saldo/i,
  /token/i,
  /authorization/i,
  /cookie/i,
]

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const MONEY_PATTERN = /(?:\$|ARS\s*|USD\s*)\s*\d[\d.,]*/gi

type RouteErrorContext = {
  route: string
  operation: string
}

function shouldFilterKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

function scrubText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, FILTERED)
    .replace(MONEY_PATTERN, FILTERED)
}

function scrubUnknown(value: unknown, key = '', depth = 0): unknown {
  if (key && shouldFilterKey(key)) return FILTERED
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    const scrubbed = scrubText(value)
    return scrubbed.length > 240 ? `${scrubbed.slice(0, 240)}...` : scrubbed
  }
  if (typeof value !== 'object') return value
  if (depth >= 4) return TRUNCATED
  if (Array.isArray(value)) {
    return value.map((item) => scrubUnknown(item, '', depth + 1))
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
      entryKey,
      scrubUnknown(entryValue, entryKey, depth + 1),
    ]),
  )
}

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    message: breadcrumb.message ? scrubText(breadcrumb.message) : breadcrumb.message,
    data: breadcrumb.data
      ? (scrubUnknown(breadcrumb.data) as Breadcrumb['data'])
      : breadcrumb.data,
  }
}

function scrubException(exception: ErrorEvent['exception']): ErrorEvent['exception'] {
  if (!exception?.values) return exception

  return {
    ...exception,
    values: exception.values.map((value) => ({
      ...value,
      value: value.value ? scrubText(value.value) : value.value,
    })),
  }
}

export function getSentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    sendDefaultPii: false,
    sampleRate: 1.0,
    tracesSampleRate: 0,
    beforeSend(event: ErrorEvent): ErrorEvent {
      return {
        ...event,
        message: event.message ? scrubText(event.message) : event.message,
        user: event.user?.id ? { id: event.user.id } : undefined,
        request: event.request
          ? (scrubUnknown(event.request) as ErrorEvent['request'])
          : event.request,
        extra: event.extra
          ? (scrubUnknown(event.extra) as ErrorEvent['extra'])
          : event.extra,
        contexts: event.contexts
          ? (scrubUnknown(event.contexts) as ErrorEvent['contexts'])
          : event.contexts,
        breadcrumbs: event.breadcrumbs?.map(scrubBreadcrumb),
        exception: scrubException(event.exception),
      }
    },
    beforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
      return scrubBreadcrumb(breadcrumb)
    },
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications.',
    ],
  }
}

export function captureRouteError(error: unknown, context: RouteErrorContext): void {
  Sentry.captureException(error, {
    tags: {
      route: context.route,
      operation: context.operation,
    },
  })
}
