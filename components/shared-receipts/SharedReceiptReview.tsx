'use client'

import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle, Receipt, Trash, WarningCircle } from '@phosphor-icons/react'
import { ParsePreview, type ParsePreviewConfirmPayload } from '@/components/dashboard/ParsePreview'
import {
  SHARED_RECEIPT_ROUTES,
  getNextPendingReceiptId,
  getReceiptQueuePosition,
  normalizeReceiptResponse,
  normalizeReceiptsResponse,
  invalidateAfterSharedReceiptConfirmation,
  parseConfirmResult,
  parsePurchaseProposal,
  restoreStoredPurchaseProposal,
  type ParsedPurchaseProposal,
  type SharedReceiptSummary,
} from '@/lib/shared-receipts-ui'
import type { Account, Card } from '@/types/database'

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : fallback
}

export function SharedReceiptReview({ receiptId }: { receiptId: string }) {
  const queryClient = useQueryClient()
  const [receipt, setReceipt] = useState<SharedReceiptSummary | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [analysis, setAnalysis] = useState<ParsedPurchaseProposal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ duplicate: boolean; expenseId: string | null } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [nextReceiptId, setNextReceiptId] = useState<string | null>(null)
  const [queue, setQueue] = useState<SharedReceiptSummary[]>([])
  const queuePosition = getReceiptQueuePosition(queue, receiptId)

  const loadNextReceiptId = async (): Promise<string | null> => {
    try {
      const response = await fetch(SHARED_RECEIPT_ROUTES.inbox, { cache: 'no-store' })
      if (!response.ok) return null
      return getNextPendingReceiptId(normalizeReceiptsResponse(await response.json()), receiptId)
    } catch {
      return null
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [receiptResponse, accountsResponse, cardsResponse, inboxResponse] = await Promise.all([
        fetch(SHARED_RECEIPT_ROUTES.apiDetail(receiptId), { cache: 'no-store' }),
        fetch('/api/accounts', { cache: 'no-store' }),
        fetch('/api/cards', { cache: 'no-store' }),
        fetch(SHARED_RECEIPT_ROUTES.inbox, { cache: 'no-store' }),
      ])
      if (!receiptResponse.ok) throw new Error(await responseError(receiptResponse, 'No pudimos cargar el comprobante.'))
      const loadedReceipt = normalizeReceiptResponse(await receiptResponse.json())
      setReceipt(loadedReceipt)
      if (accountsResponse.ok) {
        const data = await accountsResponse.json()
        setAccounts(Array.isArray(data) ? data.filter((item: Account) => !item.archived) : [])
      }
      let loadedCards: Card[] = []
      if (cardsResponse.ok) {
        const data = await cardsResponse.json()
        loadedCards = Array.isArray(data) ? data : []
        setCards(loadedCards)
      }
      if (loadedReceipt) setAnalysis(restoreStoredPurchaseProposal(loadedReceipt, loadedCards))
      if (inboxResponse.ok) {
        const summaries = normalizeReceiptsResponse(await inboxResponse.json())
        const detailedQueue = await Promise.all(summaries.map(async (summary) => {
          if (summary.id === loadedReceipt?.id) return loadedReceipt
          try {
            const response = await fetch(SHARED_RECEIPT_ROUTES.apiDetail(summary.id), { cache: 'no-store' })
            if (!response.ok) return summary
            return normalizeReceiptResponse(await response.json()) ?? summary
          } catch {
            return summary
          }
        }))
        setQueue(detailedQueue)
      } else if (loadedReceipt) {
        setQueue([loadedReceipt])
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos cargar el comprobante.')
    } finally {
      setLoading(false)
    }
  }, [receiptId])

  useEffect(() => { void load() }, [load])

  const analyze = async () => {
    setAnalyzing(true)
    setError(null)
    try {
      const response = await fetch(
        SHARED_RECEIPT_ROUTES.analyze(receiptId, receipt?.status === 'parse_failed'),
        { method: 'POST' },
      )
      if (!response.ok) {
        if (response.status === 422) {
          setReceipt((current) => current ? { ...current, status: 'parse_failed' } : current)
        }
        throw new Error(await responseError(response, 'No pudimos analizar el comprobante.'))
      }
      const parsed = parsePurchaseProposal(await response.json())
      if (parsed.supported) {
        const matchingCards = parsed.proposal.card_last_four
          ? cards.filter((card) => card.last_four === parsed.proposal.card_last_four)
          : []
        setAnalysis({
          supported: true,
          proposal: {
            ...parsed.proposal,
            card_id: matchingCards.length === 1 ? matchingCards[0].id : parsed.proposal.card_id,
          },
        })
      } else {
        setAnalysis(parsed)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos analizar el comprobante.')
    } finally {
      setAnalyzing(false)
    }
  }

  const confirmPurchase = async (payload: ParsePreviewConfirmPayload) => {
    setError(null)
    const response = await fetch(SHARED_RECEIPT_ROUTES.confirm(receiptId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(await responseError(response, 'No pudimos confirmar la compra.'))
    const result = parseConfirmResult(await response.json())
    await invalidateAfterSharedReceiptConfirmation(queryClient)
    setNextReceiptId(await loadNextReceiptId())
    setDone(result)
  }

  const dismiss = async () => {
    if (!window.confirm('¿Descartar este comprobante? No se creará ningún movimiento.')) return
    setDismissing(true)
    setError(null)
    const contract = SHARED_RECEIPT_ROUTES.dismiss(receiptId)
    try {
      const response = await fetch(contract.url, { method: contract.method })
      if (!response.ok) throw new Error(await responseError(response, 'No pudimos descartar el comprobante.'))
      await queryClient.invalidateQueries({ queryKey: ['shared-receipts'] })
      setNextReceiptId(await loadNextReceiptId())
      setDismissed(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos descartar el comprobante.')
    } finally {
      setDismissing(false)
    }
  }


  if (loading) return <main className="mx-auto min-h-screen max-w-md bg-bg-primary px-5 pt-safe"><p className="py-12 text-center text-sm text-text-tertiary">Cargando comprobante…</p></main>

  if (done || dismissed) return (
    <main className="mx-auto min-h-screen max-w-md bg-bg-primary px-5 pt-safe">
      <section className="mt-10 rounded-card border border-success/20 bg-success/5 p-6 text-center">
        <CheckCircle size={42} weight="duotone" className="mx-auto text-success" />
        <h1 className="mt-3 text-xl font-bold text-text-primary">{dismissed ? 'Comprobante descartado' : done?.duplicate ? 'Esta compra ya estaba confirmada' : 'Compra confirmada'}</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{dismissed ? 'No se creó ningún movimiento.' : done?.duplicate ? 'No duplicamos el movimiento existente.' : 'El movimiento se creó con los datos que revisaste.'}</p>
        <Link href={nextReceiptId ? SHARED_RECEIPT_ROUTES.review(nextReceiptId) : '/'} className="mt-5 inline-flex rounded-button bg-primary px-5 py-3 text-sm font-semibold text-white">{nextReceiptId ? 'Revisar siguiente' : 'Volver al Home'}</Link>
      </section>
    </main>
  )

  if (!receipt) return (
    <main className="mx-auto min-h-screen max-w-md bg-bg-primary px-5 pt-safe">
      <Link href="/" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={16} />Volver</Link>
      <section className="mt-6 rounded-card border border-border-subtle bg-bg-secondary p-5"><h1 className="text-lg font-bold text-text-primary">El comprobante ya no está pendiente</h1><p className="mt-2 text-sm text-text-secondary">Puede haber sido confirmado o descartado desde otra sesión.</p><button type="button" onClick={() => void load()} className="mt-4 text-sm font-semibold text-primary">Actualizar</button></section>
    </main>
  )

  return (
    <main className="mx-auto min-h-screen max-w-md bg-bg-primary px-5 pt-safe pb-tab-bar">
      <header className="flex items-center justify-between py-4"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={16} />Bandeja</Link><Receipt size={22} className="text-primary" /></header>
      {queue.length > 1 && <section aria-label="Comprobantes pendientes" className="mb-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-text-primary">Comprobantes pendientes</p>
          <p className="text-xs tabular-nums text-text-tertiary">{queuePosition.current} de {queuePosition.total}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {queue.map((receipt, index) => {
            const current = receipt.id === receiptId
            const parsed = receipt.parsed_payload ? parsePurchaseProposal(receipt.parsed_payload) : null
            const label = parsed?.supported ? parsed.proposal.description : `Comprobante ${index + 1}`
            return <Link
              key={receipt.id}
              href={SHARED_RECEIPT_ROUTES.review(receipt.id)}
              aria-current={current ? 'page' : undefined}
              className={`w-28 shrink-0 overflow-hidden rounded-input border text-left ${current ? 'border-primary bg-primary/5' : 'border-border-subtle bg-bg-secondary'}`}
            >
              {receipt.image_url
                ? <div role="img" aria-label={`Vista previa de ${label}`} className="h-20 bg-bg-tertiary bg-cover bg-center" style={{ backgroundImage: `url(${receipt.image_url})` }} />
                : <div className="flex h-20 items-center justify-center bg-bg-tertiary"><Receipt size={24} className="text-text-disabled" /></div>}
              <div className="p-2">
                <p className="truncate text-[11px] font-semibold text-text-primary">{label}</p>
                <p className="mt-0.5 text-[10px] text-text-tertiary">{current ? analyzing ? 'Analizando…' : 'Revisando' : receipt.status === 'needs_review' ? 'Analizado' : 'Pendiente'}</p>
              </div>
            </Link>
          })}
        </div>
      </section>}
      <section className="rounded-card border border-border-subtle bg-bg-secondary p-5">
        <p className="type-label text-primary">Revisión pendiente</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-text-primary">Revisá antes de guardar</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">El análisis solo prepara una propuesta editable. No habrá cambios financieros hasta que confirmes.</p>
        <div className="mt-4 rounded-input bg-bg-tertiary p-3 text-xs text-text-tertiary"><p>{receipt.filename || 'Imagen enviada desde iPhone'}</p><p className="mt-1">Recibido {new Date(receipt.created_at).toLocaleString('es-AR')}</p></div>
        {!analysis && <button type="button" onClick={() => void analyze()} disabled={analyzing} className="mt-5 min-h-11 w-full rounded-button bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{analyzing ? 'Analizando…' : receipt.status === 'parse_failed' ? 'Reintentar análisis' : 'Analizar comprobante'}</button>}
      </section>

      {analysis && !analysis.supported && <section className="mt-4 rounded-card border border-warning/30 bg-warning/5 p-5"><WarningCircle size={24} className="text-warning" /><h2 className="mt-2 text-base font-bold text-text-primary">Todavía no podemos confirmar este tipo</h2><p className="mt-2 text-sm leading-6 text-text-secondary">{analysis.reason} Podés descartarlo sin crear movimientos.</p></section>}

      {analysis?.supported && <section className="mt-4 rounded-card border border-border-subtle bg-bg-secondary p-5">
        <ParsePreview
          data={analysis.proposal}
          cards={cards}
          accounts={accounts}
          onConfirm={confirmPurchase}
          onSave={() => undefined}
          onCancel={() => window.history.back()}
          embedded
        />
      </section>}

      {error && <p role="alert" className="mt-4 rounded-input bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <button type="button" onClick={() => void dismiss()} disabled={dismissing} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-button border border-border-ocean text-sm font-semibold text-text-secondary disabled:opacity-50"><Trash size={16} />{dismissing ? 'Descartando…' : 'Descartar sin guardar'}</button>
    </main>
  )
}
