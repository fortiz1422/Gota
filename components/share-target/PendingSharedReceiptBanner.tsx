'use client'

import { useEffect, useRef, useState } from 'react'
import { trackEvent } from '@/lib/product-analytics/client'
import {
  clearPendingSharedReceipt,
  consumeShareTargetFocusRequest,
  readPendingSharedReceipt,
  readSharedReceiptFile,
  type PendingSharedReceipt,
} from '@/lib/share-target'

interface PendingSharedReceiptBannerProps {
  canOpenComposer: boolean
  onOpenComposer: () => void
}

function bucketSharedFileType(type: string): 'image' | 'other' {
  return type.startsWith('image/') ? 'image' : 'other'
}

export function PendingSharedReceiptBanner({
  canOpenComposer,
  onOpenComposer,
}: PendingSharedReceiptBannerProps) {
  const [pendingShare, setPendingShare] = useState<PendingSharedReceipt | null>(null)
  const trackedReadyRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const syncPendingShare = async () => {
      const stored = readPendingSharedReceipt()
      if (!stored) {
        if (!cancelled) setPendingShare(null)
        return
      }

      const file = await readSharedReceiptFile(stored.id)
      if (!file) {
        await clearPendingSharedReceipt(stored.id)
        if (!cancelled) setPendingShare(null)
        return
      }

      if (cancelled) return
      setPendingShare(stored)

      if (trackedReadyRef.current !== stored.id) {
        trackedReadyRef.current = stored.id
        console.info('[share-target] pending share ready in dashboard', {
          id: stored.id,
          type: stored.type,
          size: stored.size,
        })
        trackEvent('share_target_ready', {
          file_kind: bucketSharedFileType(stored.type),
          has_file: true,
        })
      }

      if (canOpenComposer && consumeShareTargetFocusRequest()) {
        onOpenComposer()
      }
    }

    void syncPendingShare()
    window.addEventListener('focus', syncPendingShare)

    return () => {
      cancelled = true
      window.removeEventListener('focus', syncPendingShare)
    }
  }, [canOpenComposer, onOpenComposer])

  if (!pendingShare) return null

  const handleDismiss = async () => {
    await clearPendingSharedReceipt(pendingShare.id)
    setPendingShare(null)
  }

  return (
    <section className="rounded-card border border-primary/20 bg-primary/8 px-4 py-4">
      <p className="type-label text-primary">Captura compartida</p>
      <h2 className="mt-2 text-[18px] font-semibold tracking-[-0.02em] text-text-primary">
        Tu archivo ya llegó a Gota
      </h2>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        {canOpenComposer
          ? 'Lo guardamos en este dispositivo y lo dejamos listo para seguir la carga desde el Home.'
          : 'Lo guardamos en este dispositivo. Primero necesitás crear una cuenta y después vas a poder seguir la carga desde el Home.'}
      </p>
      <p className="mt-3 text-xs text-text-secondary">
        {pendingShare.name} · {pendingShare.type || 'archivo'}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {canOpenComposer && (
          <button
            type="button"
            onClick={onOpenComposer}
            className="rounded-button bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:brightness-105"
          >
            Abrir carga
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            void handleDismiss()
          }}
          className="rounded-button border border-border-subtle px-4 py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-white/60"
        >
          Descartar captura
        </button>
      </div>
    </section>
  )
}
