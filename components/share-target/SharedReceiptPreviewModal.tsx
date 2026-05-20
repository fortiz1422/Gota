'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { ImageSquare, WarningCircle } from '@phosphor-icons/react'
import { ParsePreview } from '@/components/dashboard/ParsePreview'
import { Modal } from '@/components/ui/Modal'
import { InlineError } from '@/components/ui/InlineError'
import { trackEvent } from '@/lib/product-analytics/client'
import {
  clearPendingSharedReceipt,
  readSharedReceiptFile,
  type PendingSharedReceipt,
} from '@/lib/share-target'
import type { Account, Card } from '@/types/database'

interface ParsedData {
  is_valid: true
  amount: number
  currency: 'ARS' | 'USD'
  category: string
  description: string
  is_want: boolean | null
  is_recurring?: boolean | null
  is_extraordinary?: boolean | null
  payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
  card_id: string | null
  installments?: number | null
  date: string
}

type InvalidParsedData = {
  is_valid: false
  reason?: string
}

interface SharedReceiptPreviewModalProps {
  open: boolean
  pendingShare: PendingSharedReceipt | null
  canContinue: boolean
  accounts: Account[]
  cards: Card[]
  onClose: () => void
  onCleared: () => void
  onSaved: () => void
}

function bucketSharedFileType(type: string): 'image' | 'other' {
  return type.startsWith('image/') ? 'image' : 'other'
}

export function SharedReceiptPreviewModal({
  open,
  pendingShare,
  canContinue,
  accounts,
  cards,
  onClose,
  onCleared,
  onSaved,
}: SharedReceiptPreviewModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const previewUrl = useMemo(() => {
    if (!file || !file.type.startsWith('image/')) return null
    return URL.createObjectURL(file)
  }, [file])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    if (!open || !pendingShare) return

    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return

      setLoading(true)
      setIsParsing(false)
      setError(null)
      setFile(null)
      setParsedData(null)

      const sharedFile = await readSharedReceiptFile(pendingShare.id)
      if (cancelled) return

      if (!sharedFile) {
        setError('No encontramos la captura compartida. Intentá compartirla de nuevo.')
        trackEvent('share_target_failed', {
          failure_type: 'missing_cached_file',
          file_kind: bucketSharedFileType(pendingShare.type),
        })
        setLoading(false)
        return
      }

      setFile(sharedFile)
      setLoading(false)
      trackEvent('share_target_preview_opened', {
        file_kind: bucketSharedFileType(sharedFile.type),
        has_preview: sharedFile.type.startsWith('image/'),
      })
    })()

    return () => {
      cancelled = true
    }
  }, [open, pendingShare])

  if (!open || !pendingShare) return null

  const handleDismiss = async () => {
    await clearPendingSharedReceipt(pendingShare.id)
    trackEvent('share_target_dismissed', {
      file_kind: bucketSharedFileType(pendingShare.type),
    })
    onCleared()
  }

  const handleContinue = async () => {
    if (!file) {
      setError('No encontramos la captura compartida. Intentá compartirla de nuevo.')
      return
    }

    setIsParsing(true)
    setError(null)
    trackEvent('share_target_continue_requested', {
      file_kind: bucketSharedFileType(file.type),
      has_preview: Boolean(previewUrl),
    })
    trackEvent('share_target_parse_started', {
      file_kind: bucketSharedFileType(file.type),
    })

    try {
      const formData = new FormData()
      formData.append('receipt', file)

      const response = await fetch('/api/parse-expense', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('parse failed')
      }

      const result = (await response.json()) as ParsedData | InvalidParsedData
      if (result.is_valid !== true) {
        const reason = result.reason ? result.reason : 'No pudimos interpretar la captura.'
        setError(reason)
        trackEvent('share_target_failed', {
          failure_type: 'invalid_parse',
          file_kind: bucketSharedFileType(file.type),
        })
        setIsParsing(false)
        return
      }

      setParsedData(result)
      setIsParsing(false)
      trackEvent('share_target_parse_succeeded', {
        file_kind: bucketSharedFileType(file.type),
        currency: result.currency,
        payment_method: result.payment_method,
      })
    } catch {
      setError('No pudimos leer la captura. Probá de nuevo o cargá el gasto manualmente.')
      trackEvent('share_target_failed', {
        failure_type: 'parse_request_failed',
        file_kind: bucketSharedFileType(file.type),
      })
      setIsParsing(false)
    }
  }

  if (parsedData) {
    return (
      <ParsePreview
        data={parsedData}
        cards={cards}
        accounts={accounts}
        onCancel={() => setParsedData(null)}
        onSave={() => {
          void clearPendingSharedReceipt(pendingShare.id).then(() => {
            onCleared()
            onSaved()
          })
        }}
      />
    )
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-label text-primary">Captura compartida</p>
          <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-text-primary">
            Revisá el archivo antes de seguir
          </h2>
        </div>
        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ImageSquare size={20} weight="duotone" />
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-text-secondary">
        Lo guardamos en este dispositivo para que puedas seguir la carga desde el Home sin perder la captura.
      </p>

      <div className="mt-5 overflow-hidden rounded-card border border-border-subtle bg-white/70">
        {loading ? (
          <div className="flex min-h-[220px] items-center justify-center bg-bg-secondary/70">
            <span className="spinner" style={{ width: 24, height: 24 }} />
          </div>
        ) : previewUrl ? (
          <Image
            src={previewUrl}
            alt={pendingShare.name}
            width={1200}
            height={1600}
            unoptimized
            className="max-h-[340px] w-full bg-bg-secondary object-contain"
          />
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 bg-bg-secondary/70 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              {error ? <WarningCircle size={24} weight="duotone" /> : <ImageSquare size={24} weight="duotone" />}
            </div>
            <p className="text-sm font-medium text-text-primary">
              {error ? 'No pudimos abrir la captura' : 'Vista previa no disponible'}
            </p>
            <p className="text-xs leading-5 text-text-secondary">
              {error
                ? error
                : 'El archivo quedó guardado igual. Podés seguir la carga o descartarlo desde acá.'}
            </p>
          </div>
        )}

        <div className="border-t border-border-subtle px-4 py-3">
          <p className="text-sm font-medium text-text-primary">{pendingShare.name}</p>
          <p className="mt-1 text-xs text-text-secondary">
            {pendingShare.type || 'archivo'} · {(pendingShare.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
      </div>

      {!canContinue && (
        <div className="mt-4 rounded-card border border-warning/20 bg-warning/8 px-4 py-3 text-sm leading-6 text-text-secondary">
          Primero necesitás crear una cuenta para poder seguir la carga desde el Home.
        </div>
      )}

      <InlineError message={error} className="mt-4" />

      <div className="mt-6 flex flex-col gap-2">
        {canContinue && (
          <button
            type="button"
            onClick={() => {
              void handleContinue()
            }}
            disabled={loading || isParsing}
            className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-bg-primary transition-transform active:scale-95 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isParsing ? 'Leyendo captura...' : 'Seguir con la carga'}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            void handleDismiss()
          }}
          className="w-full rounded-button border border-border-subtle py-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
        >
          Descartar captura
        </button>
      </div>
    </Modal>
  )
}
