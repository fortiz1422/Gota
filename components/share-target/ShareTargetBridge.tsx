'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/product-analytics/client'
import {
  hydratePendingSharedReceipt,
  requestShareTargetFocus,
  type PendingSharedReceipt,
} from '@/lib/share-target'

interface ShareTargetBridgeProps {
  shareTargetId: string | null
}

function bucketSharedFileType(type: string): 'image' | 'other' {
  return type.startsWith('image/') ? 'image' : 'other'
}

export function ShareTargetBridge({ shareTargetId }: ShareTargetBridgeProps) {
  const supabase = useMemo(() => createClient(), [])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const redirectWithPendingShare = async (receipt: PendingSharedReceipt) => {
      requestShareTargetFocus()
      console.info('[share-target] pending share hydrated', {
        id: receipt.id,
        name: receipt.name,
        type: receipt.type,
        size: receipt.size,
      })
      trackEvent('share_target_received', {
        file_kind: bucketSharedFileType(receipt.type),
        has_file: true,
      })

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (cancelled) return
      window.location.replace(user ? '/' : '/login')
    }

    const run = async () => {
      if (!shareTargetId) {
        console.warn('[share-target] missing shareTargetId')
        trackEvent('share_target_failed', { reason: 'missing_id' })
        setError('Falta identificar el archivo compartido.')
        return
      }

      const receipt = await hydratePendingSharedReceipt(shareTargetId)
      if (!receipt) {
        console.warn('[share-target] shared payload not found in cache', { shareTargetId })
        trackEvent('share_target_failed', { reason: 'cache_miss' })
        setError('No encontramos la captura compartida. Intentá compartirla de nuevo.')
        return
      }

      await redirectWithPendingShare(receipt)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [shareTargetId, supabase])

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-6 text-center">
      <div className="max-w-sm rounded-card border border-border-subtle bg-bg-secondary/70 px-5 py-6 shadow-sm">
        <p className="type-label text-text-secondary">Share target</p>
        <h1 className="mt-3 text-[24px] font-bold tracking-[-0.03em] text-text-primary">
          {error ? 'No pudimos abrir la captura' : 'Preparando tu captura'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          {error
            ? error
            : 'Guardamos el archivo compartido y te redirigimos al Home para seguir la carga sin romper la sesión.'}
        </p>
      </div>
    </div>
  )
}
