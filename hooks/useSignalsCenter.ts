'use client'

import { useQuery } from '@tanstack/react-query'
import type { SignalCenterModel } from '@/lib/intelligence/signal-center'
import type { Currency } from '@/lib/intelligence/types'

export type UseSignalsCenterOptions = {
  /** Solo activar cuando la flag y la superficie de campana/sheet lo pidan. */
  enabled: boolean
  /** La API conserva la moneda fuente; este valor únicamente separa la caché. */
  currency?: Currency
}

export const signalsCenterQueryKey = (currency?: Currency) =>
  ['intelligence', 'signals', currency ?? 'source'] as const

async function fetchSignalsCenter(): Promise<SignalCenterModel> {
  const response = await fetch('/api/intelligence/signals')
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: unknown } | null
    const message = typeof body?.error === 'string' ? body.error : 'No pudimos cargar tus señales.'
    throw new Error(message)
  }

  return (await response.json()) as SignalCenterModel
}

/** Query lazy: declararla no dispara red hasta que la superficie la habilita. */
export function useSignalsCenter({ enabled, currency }: UseSignalsCenterOptions) {
  return useQuery({
    queryKey: signalsCenterQueryKey(currency),
    queryFn: fetchSignalsCenter,
    enabled,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
  })
}
