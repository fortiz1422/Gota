'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle, Receipt, Trash, WarningCircle } from '@phosphor-icons/react'
import { CATEGORIES } from '@/lib/validation/schemas'
import {
  SHARED_RECEIPT_ROUTES,
  buildConfirmPurchasePayload,
  normalizeReceiptResponse,
  parseConfirmResult,
  parsePurchaseProposal,
  type ConfirmPurchaseForm,
  type ParsedPurchaseProposal,
  type SharedReceiptSummary,
} from '@/lib/shared-receipts-ui'
import type { Account, Card } from '@/types/database'

async function responseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: unknown } | null
  return typeof body?.error === 'string' ? body.error : fallback
}

export function SharedReceiptReview({ receiptId }: { receiptId: string }) {
  const [receipt, setReceipt] = useState<SharedReceiptSummary | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [analysis, setAnalysis] = useState<ParsedPurchaseProposal | null>(null)
  const [form, setForm] = useState<ConfirmPurchaseForm | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ duplicate: boolean; expenseId: string | null } | null>(null)
  const [dismissed, setDismissed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [receiptResponse, accountsResponse, cardsResponse] = await Promise.all([
        fetch(SHARED_RECEIPT_ROUTES.detail(receiptId), { cache: 'no-store' }),
        fetch('/api/accounts', { cache: 'no-store' }),
        fetch('/api/cards', { cache: 'no-store' }),
      ])
      if (!receiptResponse.ok) throw new Error(await responseError(receiptResponse, 'No pudimos cargar el comprobante.'))
      setReceipt(normalizeReceiptResponse(await receiptResponse.json()))
      if (accountsResponse.ok) {
        const data = await accountsResponse.json()
        setAccounts(Array.isArray(data) ? data.filter((item: Account) => !item.archived) : [])
      }
      if (cardsResponse.ok) {
        const data = await cardsResponse.json()
        setCards(Array.isArray(data) ? data : [])
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
      setAnalysis(parsed)
      if (parsed.supported) {
        const matchingCards = parsed.proposal.card_last_four
          ? cards.filter((card) => card.last_four === parsed.proposal.card_last_four)
          : []
        setForm({
          description: parsed.proposal.description,
          amount: String(parsed.proposal.amount),
          date: parsed.proposal.date,
          currency: parsed.proposal.currency,
          category: parsed.proposal.category,
          account_id: parsed.proposal.account_id,
          card_id: matchingCards.length === 1 ? matchingCards[0].id : parsed.proposal.card_id,
          installments: String(parsed.proposal.installments),
          payment_method: parsed.proposal.payment_method,
          is_want: parsed.proposal.is_want,
        })
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos analizar el comprobante.')
    } finally {
      setAnalyzing(false)
    }
  }

  const confirmPurchase = async () => {
    if (!form) return
    setConfirming(true)
    setError(null)
    try {
      const payload = buildConfirmPurchasePayload(form)
      const response = await fetch(SHARED_RECEIPT_ROUTES.confirm(receiptId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(await responseError(response, 'No pudimos confirmar la compra.'))
      setDone(parseConfirmResult(await response.json()))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos confirmar la compra.')
    } finally {
      setConfirming(false)
    }
  }

  const dismiss = async () => {
    if (!window.confirm('¿Descartar este comprobante? No se creará ningún movimiento.')) return
    setDismissing(true)
    setError(null)
    const contract = SHARED_RECEIPT_ROUTES.dismiss(receiptId)
    try {
      const response = await fetch(contract.url, { method: contract.method })
      if (!response.ok) throw new Error(await responseError(response, 'No pudimos descartar el comprobante.'))
      setDismissed(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No pudimos descartar el comprobante.')
    } finally {
      setDismissing(false)
    }
  }

  const setField = <K extends keyof ConfirmPurchaseForm>(key: K, value: ConfirmPurchaseForm[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current)
  }

  if (loading) return <main className="mx-auto min-h-screen max-w-md bg-bg-primary px-5 pt-safe"><p className="py-12 text-center text-sm text-text-tertiary">Cargando comprobante…</p></main>

  if (done || dismissed) return (
    <main className="mx-auto min-h-screen max-w-md bg-bg-primary px-5 pt-safe">
      <section className="mt-10 rounded-card border border-success/20 bg-success/5 p-6 text-center">
        <CheckCircle size={42} weight="duotone" className="mx-auto text-success" />
        <h1 className="mt-3 text-xl font-bold text-text-primary">{dismissed ? 'Comprobante descartado' : done?.duplicate ? 'Esta compra ya estaba confirmada' : 'Compra confirmada'}</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{dismissed ? 'No se creó ningún movimiento.' : done?.duplicate ? 'No duplicamos el movimiento existente.' : 'El movimiento se creó con los datos que revisaste.'}</p>
        <Link href="/" className="mt-5 inline-flex rounded-button bg-primary px-5 py-3 text-sm font-semibold text-white">Volver al Home</Link>
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
      <section className="rounded-card border border-border-subtle bg-bg-secondary p-5">
        <p className="type-label text-primary">Revisión pendiente</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-text-primary">Revisá antes de guardar</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">El análisis solo prepara una propuesta editable. No habrá cambios financieros hasta que confirmes.</p>
        <div className="mt-4 rounded-input bg-bg-tertiary p-3 text-xs text-text-tertiary"><p>{receipt.filename || 'Imagen enviada desde iPhone'}</p><p className="mt-1">Recibido {new Date(receipt.created_at).toLocaleString('es-AR')}</p></div>
        {!analysis && <button type="button" onClick={() => void analyze()} disabled={analyzing} className="mt-5 min-h-11 w-full rounded-button bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{analyzing ? 'Analizando…' : receipt.status === 'parse_failed' ? 'Reintentar análisis' : 'Analizar comprobante'}</button>}
      </section>

      {analysis && !analysis.supported && <section className="mt-4 rounded-card border border-warning/30 bg-warning/5 p-5"><WarningCircle size={24} className="text-warning" /><h2 className="mt-2 text-base font-bold text-text-primary">Todavía no podemos confirmar este tipo</h2><p className="mt-2 text-sm leading-6 text-text-secondary">{analysis.reason} Podés descartarlo sin crear movimientos.</p></section>}

      {analysis?.supported && form && <section className="mt-4 rounded-card border border-border-subtle bg-bg-secondary p-5">
        <h2 className="text-lg font-bold text-text-primary">Propuesta de compra</h2>
        <div className="mt-4 space-y-4">
          <label className="block text-xs font-semibold text-text-secondary">Descripción<input value={form.description} onChange={(event) => setField('description', event.target.value)} className="mt-1 w-full rounded-input border border-border-ocean bg-white px-3 py-2.5 text-sm text-text-primary" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-semibold text-text-secondary">Monto<input inputMode="decimal" value={form.amount} onChange={(event) => setField('amount', event.target.value)} className="mt-1 w-full rounded-input border border-border-ocean bg-white px-3 py-2.5 text-sm text-text-primary" /></label>
            <label className="block text-xs font-semibold text-text-secondary">Moneda<select value={form.currency} onChange={(event) => setField('currency', event.target.value as 'ARS' | 'USD')} className="mt-1 w-full rounded-input border border-border-ocean bg-white px-3 py-2.5 text-sm text-text-primary"><option value="ARS">ARS</option><option value="USD">USD</option></select></label>
          </div>
          <label className="block text-xs font-semibold text-text-secondary">Fecha<input type="date" value={form.date} onChange={(event) => setField('date', event.target.value)} className="mt-1 w-full rounded-input border border-border-ocean bg-white px-3 py-2.5 text-sm text-text-primary" /></label>
          <label className="block text-xs font-semibold text-text-secondary">Categoría<select value={form.category} onChange={(event) => setField('category', event.target.value)} className="mt-1 w-full rounded-input border border-border-ocean bg-white px-3 py-2.5 text-sm text-text-primary"><option value="">Elegí una categoría</option>{CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label className="block text-xs font-semibold text-text-secondary">Cuenta<select value={form.account_id ?? ''} onChange={(event) => setForm((current) => current ? { ...current, account_id: event.target.value || null, ...(event.target.value ? { card_id: null, payment_method: 'DEBIT' as const } : {}) } : current)} className="mt-1 w-full rounded-input border border-border-ocean bg-white px-3 py-2.5 text-sm text-text-primary"><option value="">Sin cuenta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label className="block text-xs font-semibold text-text-secondary">Tarjeta<select value={form.card_id ?? ''} onChange={(event) => setForm((current) => current ? { ...current, card_id: event.target.value || null, ...(event.target.value ? { account_id: null, payment_method: 'CREDIT' as const } : {}) } : current)} className="mt-1 w-full rounded-input border border-border-ocean bg-white px-3 py-2.5 text-sm text-text-primary"><option value="">Sin tarjeta</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name}{card.last_four ? ` •••• ${card.last_four}` : ''}</option>)}</select></label>
          <label className="block text-xs font-semibold text-text-secondary">Cuotas<input type="number" min="1" step="1" value={form.installments} onChange={(event) => setField('installments', event.target.value)} className="mt-1 w-full rounded-input border border-border-ocean bg-white px-3 py-2.5 text-sm text-text-primary" /></label>
        </div>
        <button type="button" onClick={() => void confirmPurchase()} disabled={confirming} className="mt-5 min-h-12 w-full rounded-button bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{confirming ? 'Confirmando…' : 'Confirmar compra'}</button>
      </section>}

      {error && <p role="alert" className="mt-4 rounded-input bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <button type="button" onClick={() => void dismiss()} disabled={dismissing} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-button border border-border-ocean text-sm font-semibold text-text-secondary disabled:opacity-50"><Trash size={16} />{dismissing ? 'Descartando…' : 'Descartar sin guardar'}</button>
    </main>
  )
}
