'use client'

import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, CheckCircle, Receipt, Trash, WarningCircle, X } from '@phosphor-icons/react'
import { ParsePreview, type ParsePreviewConfirmPayload } from '@/components/dashboard/ParsePreview'
import { Modal } from '@/components/ui/Modal'
import {
  SHARED_RECEIPT_ROUTES,
  getNextReviewReceiptId,
  getReceiptQueuePosition,
  getReviewCompletionLabel,
  createReceiptRequestGuard,
  normalizeReceiptResponse,
  normalizeReceiptsResponse,
  invalidateAfterSharedReceiptConfirmation,
  matchReceiptCard,
  parseConfirmResult,
  parsePurchaseProposal,
  requireReferenceArray,
  restoreStoredPurchaseProposal,
  summarizeReviewBatch,
  type ParsedPurchaseProposal,
  type ReviewBatchOutcome,
  type SharedReceiptSummary,
} from '@/lib/shared-receipts-ui'
import type { Account, Card } from '@/types/database'

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : fallback
}

export function SharedReceiptReview({ receiptId }: { receiptId: string }) {
  const queryClient = useQueryClient()
  const [activeReceiptId, setActiveReceiptId] = useState(receiptId)
  const [completedReceiptIds, setCompletedReceiptIds] = useState<Set<string>>(new Set())
  const [batchOutcomes, setBatchOutcomes] = useState<Record<string, ReviewBatchOutcome>>({})
  const [batchComplete, setBatchComplete] = useState(false)
  const cardsRef = useRef<Card[]>([])
  const sessionLoaded = useRef(false)
  const [receipt, setReceipt] = useState<SharedReceiptSummary | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [analysis, setAnalysis] = useState<ParsedPurchaseProposal | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aliasSaveFailed, setAliasSaveFailed] = useState(false)
  const [queue, setQueue] = useState<SharedReceiptSummary[]>([])
  const [previewReceipt, setPreviewReceipt] = useState<SharedReceiptSummary | null>(null)
  const pendingPreviewReviewId = useRef<string | null>(null)
  const pendingAutoPreviewId = useRef<string | null>(null)
  const loadRequestGuard = useRef(createReceiptRequestGuard(receiptId))
  const analyzeRequestGuard = useRef(createReceiptRequestGuard(receiptId))
  const analyzeRef = useRef<((targetId: string, targetReceipt: SharedReceiptSummary) => Promise<void>) | null>(null)
  const queuePosition = getReceiptQueuePosition(queue, activeReceiptId)
  const completionLabel = getReviewCompletionLabel(queue, activeReceiptId, completedReceiptIds)
  const previewLoading = previewReceipt?.id === activeReceiptId && loading && receipt?.id !== previewReceipt.id
  const previewAnalyzing = previewReceipt?.id === activeReceiptId && analyzing
  const previewError = previewReceipt?.id === activeReceiptId ? error : null

  const batchSummary = summarizeReviewBatch(batchOutcomes)

  const selectReceipt = useCallback((nextId: string) => {
    if (nextId === activeReceiptId) return
    window.history.replaceState(null, '', SHARED_RECEIPT_ROUTES.review(nextId))
    loadRequestGuard.current.activate(nextId)
    analyzeRequestGuard.current.activate(nextId)
    setActiveReceiptId(nextId)
    setReceipt(null)
    setAnalysis(null)
    setAnalyzing(false)
    setError(null)
  }, [activeReceiptId])

  const advanceAfterDurableAction = useCallback((currentId: string, outcome: ReviewBatchOutcome) => {
    const nextCompleted = new Set(completedReceiptIds)
    nextCompleted.add(currentId)
    setCompletedReceiptIds(nextCompleted)
    setBatchOutcomes((current) => ({ ...current, [currentId]: outcome }))
    const nextId = getNextReviewReceiptId(queue, currentId, nextCompleted)
    if (nextId) {
      pendingAutoPreviewId.current = nextId
      selectReceipt(nextId)
      return
    }
    setBatchComplete(true)
  }, [completedReceiptIds, queue, selectReceipt])
  const load = useCallback(async () => {
    const request = loadRequestGuard.current.start(activeReceiptId)
    const isCurrentLoad = () => loadRequestGuard.current.isCurrent(request)
    if (sessionLoaded.current) {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(SHARED_RECEIPT_ROUTES.apiDetail(activeReceiptId), { cache: 'no-store' })
        if (!response.ok) throw new Error(await responseError(response, 'No pudimos cargar el comprobante.'))
        const loadedReceipt = normalizeReceiptResponse(await response.json())
        if (!isCurrentLoad()) return
        const restoredAnalysis = loadedReceipt ? restoreStoredPurchaseProposal(loadedReceipt, cardsRef.current) : null
        const shouldStartReview = pendingPreviewReviewId.current === activeReceiptId
        const shouldAutoPreview = pendingAutoPreviewId.current === activeReceiptId && loadedReceipt?.id === activeReceiptId
        if (shouldStartReview) pendingPreviewReviewId.current = null
        if (shouldAutoPreview) pendingAutoPreviewId.current = null
        setReceipt(loadedReceipt)
        setAnalysis(restoredAnalysis)
        if (shouldAutoPreview && loadedReceipt) setPreviewReceipt(loadedReceipt)
        if (shouldStartReview && restoredAnalysis) setPreviewReceipt(null)
        if (shouldStartReview && loadedReceipt && !restoredAnalysis) void analyzeRef.current?.(activeReceiptId, loadedReceipt)
      } catch (reason) {
        if (isCurrentLoad()) setError(reason instanceof Error ? reason.message : 'No pudimos cargar el comprobante.')
      } finally {
        if (isCurrentLoad()) setLoading(false)
      }
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [receiptResponse, accountsResponse, cardsResponse, inboxResponse] = await Promise.all([
        fetch(SHARED_RECEIPT_ROUTES.apiDetail(activeReceiptId), { cache: 'no-store' }),
        fetch('/api/accounts', { cache: 'no-store' }),
        fetch('/api/cards', { cache: 'no-store' }),
        fetch(SHARED_RECEIPT_ROUTES.inbox, { cache: 'no-store' }),
      ])
      if (!receiptResponse.ok) throw new Error(await responseError(receiptResponse, 'No pudimos cargar el comprobante.'))
      if (!accountsResponse.ok) throw new Error(await responseError(accountsResponse, 'No pudimos cargar las cuentas. Reintentá.'))
      if (!cardsResponse.ok) throw new Error(await responseError(cardsResponse, 'No pudimos cargar las tarjetas. Reintentá.'))

      const [loadedReceipt, loadedAccounts, loadedCards] = await Promise.all([
        normalizeReceiptResponse(await receiptResponse.json()),
        requireReferenceArray<Account>(await accountsResponse.json(), 'cuentas'),
        requireReferenceArray<Card>(await cardsResponse.json(), 'tarjetas'),
      ])
      if (!isCurrentLoad()) return
      const activeAccounts = loadedAccounts.filter((item) => !item.archived)
      cardsRef.current = loadedCards
      const restoredAnalysis = loadedReceipt ? restoreStoredPurchaseProposal(loadedReceipt, loadedCards) : null
      const shouldStartReview = pendingPreviewReviewId.current === activeReceiptId
      const shouldAutoPreview = pendingAutoPreviewId.current === activeReceiptId && loadedReceipt?.id === activeReceiptId
      if (shouldStartReview) pendingPreviewReviewId.current = null
      if (shouldAutoPreview) pendingAutoPreviewId.current = null
      setReceipt(loadedReceipt)
      setAccounts(activeAccounts)
      setCards(loadedCards)
      setAnalysis(restoredAnalysis)
      if (shouldAutoPreview && loadedReceipt) setPreviewReceipt(loadedReceipt)
      if (shouldStartReview && restoredAnalysis) setPreviewReceipt(null)
      if (shouldStartReview && loadedReceipt && !restoredAnalysis) void analyzeRef.current?.(activeReceiptId, loadedReceipt)
      if (inboxResponse.ok) {
        const summaries = normalizeReceiptsResponse(await inboxResponse.json())
        if (!isCurrentLoad()) return
        const queueWithCurrentReceipt = summaries.some((summary) => summary.id === loadedReceipt?.id)
          ? summaries.map((summary) => summary.id === loadedReceipt?.id ? loadedReceipt : summary)
          : loadedReceipt ? [loadedReceipt, ...summaries] : summaries
        setQueue(queueWithCurrentReceipt)
        void Promise.all(queueWithCurrentReceipt.map(async (summary) => {
          if (summary.id === loadedReceipt?.id) return loadedReceipt
          try {
            const response = await fetch(SHARED_RECEIPT_ROUTES.apiDetail(summary.id), { cache: 'no-store' })
            if (!response.ok) return summary
            return normalizeReceiptResponse(await response.json()) ?? summary
          } catch {
            return summary
          }
        })).then((detailedQueue) => {
          if (isCurrentLoad()) setQueue(detailedQueue)
        })
      } else if (loadedReceipt) {
        setQueue([loadedReceipt])
      }
      sessionLoaded.current = true
    } catch (reason) {
      if (isCurrentLoad()) setError(reason instanceof Error ? reason.message : 'No pudimos cargar el comprobante.')
    } finally {
      if (isCurrentLoad()) setLoading(false)
    }
  }, [activeReceiptId])

  useEffect(() => { void load() }, [load])

  const analyze = async (targetId = activeReceiptId, targetReceipt = receipt) => {
    const request = analyzeRequestGuard.current.start(targetId)
    const isCurrentAnalyze = () => analyzeRequestGuard.current.isCurrent(request)
    setAnalyzing(true)
    setError(null)
    try {
      const response = await fetch(
        SHARED_RECEIPT_ROUTES.analyze(targetId, targetReceipt?.status === 'parse_failed'),
        { method: 'POST' },
      )
      if (!response.ok) {
        if (response.status === 422 && isCurrentAnalyze()) {
          setReceipt((current) => current?.id === targetId ? { ...current, status: 'parse_failed' } : current)
        }
        throw new Error(await responseError(response, 'No pudimos analizar el comprobante.'))
      }
      const parsed = parsePurchaseProposal(await response.json())
      if (!isCurrentAnalyze()) return
      if (parsed.supported) {
        const matchingCard = parsed.proposal.payment_method === 'CREDIT'
          ? matchReceiptCard(cards, parsed.proposal.card_brand, parsed.proposal.card_issuer)
          : null
        setAnalysis({
          supported: true,
          proposal: {
            ...parsed.proposal,
            card_id: matchingCard?.id ?? parsed.proposal.card_id,
          },
        })
      } else {
        setAnalysis(parsed)
      }
      setPreviewReceipt(null)
    } catch (reason) {
      if (isCurrentAnalyze()) setError(reason instanceof Error ? reason.message : 'No pudimos analizar el comprobante.')
    } finally {
      if (isCurrentAnalyze()) setAnalyzing(false)
    }
  }

  analyzeRef.current = analyze

  const beginPreviewReview = (targetReceipt: SharedReceiptSummary) => {
    pendingPreviewReviewId.current = targetReceipt.id
    if (targetReceipt.id !== activeReceiptId) {
      window.history.replaceState(null, '', SHARED_RECEIPT_ROUTES.review(targetReceipt.id))
      loadRequestGuard.current.activate(targetReceipt.id)
      analyzeRequestGuard.current.activate(targetReceipt.id)
      setLoading(true)
      setActiveReceiptId(targetReceipt.id)
      setAnalysis(null)
      setAnalyzing(false)
      setError(null)
      return
    }
    if (receipt?.id !== targetReceipt.id) {
      void load()
      return
    }
    pendingPreviewReviewId.current = null
    if (analysis) {
      setPreviewReceipt(null)
      return
    }
    if (!analyzing) void analyze(targetReceipt.id, receipt)
  }

  const confirmPurchase = async (payload: ParsePreviewConfirmPayload) => {
    setError(null)
    const response = await fetch(SHARED_RECEIPT_ROUTES.confirm(activeReceiptId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error(await responseError(response, 'No pudimos confirmar la compra.'))
    const result = parseConfirmResult(await response.json())
    void invalidateAfterSharedReceiptConfirmation(queryClient)
    return result
  }

  const completePurchase = (outcome?: { aliasSaved: boolean | null; financialResult?: unknown }) => {
    const result = outcome?.financialResult as { duplicate: boolean; expenseId: string | null } | undefined
    if (!result) return
    setAliasSaveFailed((current) => current || outcome?.aliasSaved === false)
    advanceAfterDurableAction(activeReceiptId, result.duplicate ? 'duplicate' : 'confirmed')
  }

  const dismiss = async () => {
    if (!window.confirm('¿Descartar este comprobante? No se creará ningún movimiento.')) return
    setDismissing(true)
    setError(null)
    const contract = SHARED_RECEIPT_ROUTES.dismiss(activeReceiptId)
    try {
      const response = await fetch(contract.url, { method: contract.method })
      if (!response.ok) throw new Error(await responseError(response, 'No pudimos descartar el comprobante.'))
      advanceAfterDurableAction(activeReceiptId, 'discarded')
      void queryClient.invalidateQueries({ queryKey: ['shared-receipts'] })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos descartar el comprobante.')
    } finally {
      setDismissing(false)
    }
  }


  if (loading && !previewReceipt) return <main className="mx-auto min-h-screen max-w-md bg-bg-primary px-5 pt-safe"><p className="py-12 text-center text-sm text-text-tertiary">Cargando comprobante…</p></main>

  if (batchComplete) return (
    <main className="mx-auto min-h-screen max-w-md bg-bg-primary px-5 pb-tab-bar pt-safe">
      <section className="mt-10 rounded-card border border-success/20 bg-success/5 p-6 text-center">
        <CheckCircle size={42} weight="duotone" className="mx-auto text-success" />
        <h1 className="mt-3 text-xl font-bold text-text-primary">Lote revisado</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">Terminaste la revisión de los comprobantes que abriste.</p>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-left">
          <div className="rounded-input bg-bg-primary p-3"><dt className="text-[11px] text-text-tertiary">Confirmados</dt><dd className="mt-1 text-lg font-bold text-text-primary">{batchSummary.confirmed}</dd></div>
          <div className="rounded-input bg-bg-primary p-3"><dt className="text-[11px] text-text-tertiary">Duplicados</dt><dd className="mt-1 text-lg font-bold text-text-primary">{batchSummary.duplicates}</dd></div>
          <div className="rounded-input bg-bg-primary p-3"><dt className="text-[11px] text-text-tertiary">Descartados</dt><dd className="mt-1 text-lg font-bold text-text-primary">{batchSummary.discarded}</dd></div>
        </dl>
        {aliasSaveFailed && <p role="status" className="mt-3 rounded-input bg-warning/10 px-3 py-2 text-sm text-warning">Algún gasto se guardó, pero no pudimos recordar el comercio.</p>}
        <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-button bg-primary px-5 py-3 text-sm font-semibold text-white">Terminar</Link>
      </section>
    </main>
  )

  if (!receipt) return (
    <main className="mx-auto min-h-screen max-w-md bg-bg-primary px-5 pt-safe">
      <Link href="/" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={16} />Volver</Link>
      <section className="mt-6 rounded-card border border-border-subtle bg-bg-secondary p-5"><h1 className="text-lg font-bold text-text-primary">No pudimos preparar la revisión</h1><p role="alert" className="mt-2 text-sm text-text-secondary">{error ?? 'El comprobante ya no está pendiente. Puede haber sido confirmado o descartado desde otra sesión.'}</p><button type="button" onClick={() => void load()} className="mt-4 text-sm font-semibold text-primary">Reintentar carga</button></section>
    </main>
  )

  return (
    <main className="mx-auto min-h-screen max-w-md bg-bg-primary px-5 pt-safe pb-tab-bar">
      <header className="flex items-center justify-between py-4"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={16} />Bandeja</Link><Receipt size={22} className="text-primary" /></header>
      {(queue.length > 1 || Boolean(queue.find((item) => item.id === activeReceiptId)?.image_url)) && <section aria-label="Comprobantes pendientes" className="mb-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-text-primary">Comprobantes pendientes</p>
          <p className="text-xs tabular-nums text-text-tertiary">{queuePosition.current} de {queuePosition.total}</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {queue.map((receipt, index) => {
            const current = receipt.id === activeReceiptId
            const parsed = receipt.parsed_payload ? parsePurchaseProposal(receipt.parsed_payload) : null
            const label = parsed?.supported ? parsed.proposal.description : `Comprobante ${index + 1}`
            return <div
              key={receipt.id}
              className={`w-28 shrink-0 overflow-hidden rounded-input border text-left ${current ? 'border-primary bg-primary/5' : 'border-border-subtle bg-bg-secondary'}`}
            >
              {receipt.image_url
                ? <button
                    type="button"
                    aria-label={`Ampliar comprobante ${index + 1}`}
                    onClick={() => setPreviewReceipt(receipt)}
                    className="block h-20 w-full bg-bg-tertiary bg-cover bg-center"
                    style={{ backgroundImage: `url(${receipt.image_url})` }}
                  />
                : <div className="flex h-20 items-center justify-center bg-bg-tertiary"><Receipt size={24} className="text-text-disabled" /></div>}
              <Link
                href={SHARED_RECEIPT_ROUTES.review(receipt.id)}
                onClick={(event) => {
                  event.preventDefault()
                  selectReceipt(receipt.id)
                }}
                aria-current={current ? 'page' : undefined}
                className="block p-2"
              >
                <p className="truncate text-[11px] font-semibold text-text-primary">{label}</p>
                <p className="mt-0.5 text-[10px] text-text-tertiary">{current ? analyzing ? 'Analizando…' : 'Revisando' : receipt.status === 'needs_review' ? 'Analizado' : 'Pendiente'}</p>
              </Link>
            </div>
          })}
        </div>
      </section>}
      {analysis?.supported && <section className="rounded-card border border-border-subtle bg-bg-secondary p-5">
        <ParsePreview
          data={analysis.proposal}
          cards={cards}
          accounts={accounts}
          onConfirm={confirmPurchase}
          onSave={completePurchase}
          onCancel={() => window.history.back()}
          aliasSource="receipt"
          confirmLabel={completionLabel}
          embedded
        />
      </section>}

      {!analysis && <section className="rounded-input bg-bg-secondary px-3 py-2 text-center text-xs text-text-tertiary">
        {receipt.image_url
          ? 'Abrí la imagen para comenzar o retomar la revisión.'
          : 'Este comprobante no tiene una imagen disponible, pero podés iniciar su revisión.'}
        {!receipt.image_url && <button type="button" onClick={() => beginPreviewReview(receipt)} disabled={analyzing} className="mt-2 block w-full font-semibold text-primary disabled:opacity-50">
          {analyzing ? 'Analizando…' : 'Revisar comprobante'}
        </button>}
      </section>}

      {analysis && !analysis.supported && <section className="mt-4 rounded-card border border-warning/30 bg-warning/5 p-5"><WarningCircle size={24} className="text-warning" /><h2 className="mt-2 text-base font-bold text-text-primary">Todavía no podemos confirmar este tipo</h2><p className="mt-2 text-sm leading-6 text-text-secondary">{analysis.reason} Podés descartarlo sin crear movimientos.</p></section>}

      {error && !previewReceipt && <p role="alert" className="mt-4 rounded-input bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <button type="button" onClick={() => void dismiss()} disabled={dismissing} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-button border border-border-ocean text-sm font-semibold text-text-secondary disabled:opacity-50"><Trash size={16} />{dismissing ? 'Descartando…' : 'Descartar sin guardar'}</button>

      {previewReceipt?.image_url && <Modal open onClose={() => setPreviewReceipt(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="receipt-image-preview-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="receipt-image-preview-title" className="text-base font-bold text-text-primary">Vista completa del comprobante</h2>
            <button type="button" aria-label="Cerrar vista" onClick={() => setPreviewReceipt(null)} className="flex size-10 items-center justify-center rounded-full text-text-secondary hover:bg-bg-tertiary"><X size={20} /></button>
          </div>
          <div className="mt-4 flex max-h-[62dvh] items-center justify-center overflow-hidden rounded-input bg-bg-tertiary">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewReceipt.image_url} alt="Comprobante ampliado" className="max-h-[62dvh] w-full object-contain" />
          </div>
          <button
            type="button"
            onClick={() => beginPreviewReview(previewReceipt)}
            disabled={previewLoading || previewAnalyzing}
            aria-busy={previewLoading || previewAnalyzing}
            className="mt-4 flex min-h-11 w-full items-center justify-center rounded-button bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {previewLoading ? 'Cargando comprobante…' : previewAnalyzing ? 'Analizando…' : previewError ? 'Reintentar' : previewReceipt.status === 'parse_failed' ? 'Reintentar análisis' : 'Revisar este comprobante'}
          </button>
          {previewError && <p role="alert" className="mt-3 rounded-input bg-danger/10 px-3 py-2 text-sm text-danger">{previewError}</p>}
        </section>
      </Modal>}
    </main>
  )
}
