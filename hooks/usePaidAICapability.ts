'use client'
import { useEffect, useState } from 'react'
/** Presentation only: every paid handler independently enforces the server policy. */
export function usePaidAICapability() {
  const [allowed, setAllowed] = useState(false)
  useEffect(() => {
    let active = true
    void fetch('/api/capabilities', { cache: 'no-store' })
      .then(async (response) =>
        response.ok ? (await response.json()).paidAI === true : false
      )
      .then((value) => {
        if (active) setAllowed(value)
      })
      .catch(() => {
        if (active) setAllowed(false)
      })
    return () => {
      active = false
    }
  }, [])
  return allowed
}
