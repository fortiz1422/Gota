'use client'

import type { ProductEventName, ProductEventProperties } from './events'
import { sanitizeEventProperties } from './events'

const SESSION_KEY = 'gota.analytics.session_id'

function getSessionId(): string | null {
  try {
    const existing = window.localStorage.getItem(SESSION_KEY)
    if (existing) return existing

    const next =
      typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    window.localStorage.setItem(SESSION_KEY, next)
    return next
  } catch {
    return null
  }
}

export function trackEvent(
  eventName: ProductEventName,
  properties: ProductEventProperties = {},
): void {
  if (typeof window === 'undefined') return

  const body = JSON.stringify({
    event_name: eventName,
    properties: sanitizeEventProperties(properties),
    session_id: getSessionId(),
    path: window.location.pathname,
  })

  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics should never block product flows.
  })
}
