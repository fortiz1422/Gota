'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body>
        <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
          <h1>Algo salio mal</h1>
          <p>No pudimos cargar esta vista. Intenta de nuevo.</p>
          <button type="button" onClick={reset}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  )
}
