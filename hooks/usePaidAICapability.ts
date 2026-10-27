'use client'
import { useEffect, useState } from 'react'

export type PaidAICapabilityState = {
  allowed: boolean
  resolved: boolean
}

/** Presentation only: every paid handler independently enforces the server policy. */
export function usePaidAICapability(): PaidAICapabilityState {
  const [state, setState] = useState<PaidAICapabilityState>({
    allowed: false,
    resolved: false,
  })
  useEffect(() => {
    let active = true
    void fetch('/api/capabilities', { cache: 'no-store' })
      .then(async (response) =>
        response.ok ? (await response.json()).paidAI === true : false
      )
      .then((value) => {
        if (active) setState({ allowed: value, resolved: true })
      })
      .catch(() => {
        if (active) setState({ allowed: false, resolved: true })
      })
    return () => {
      active = false
    }
  }, [])
  return state
}
