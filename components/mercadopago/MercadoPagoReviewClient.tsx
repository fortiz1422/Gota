'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowClockwise,
  Wallet,
} from '@phosphor-icons/react'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { ConfirmationSurface } from '@/components/ui/ConfirmationSurface'

import {
  buildConfirmExpensePayload,
  classifyMercadoPagoMovements,
  pendingMercadoPagoReviewBucketCount,
  getDisplayExpenseDescription,
  getInitialExpenseDescription,
  getMercadoPagoDisplayAmount,
  getMercadoPagoReviewDate,
  isReviewableMercadoPagoExpense,
  isReviewableMercadoPagoCardPurchase,
  sortMercadoPagoPendingMovements,
  type MercadoPagoMovement,
  selectMovementsOnOrBefore,
} from '@/lib/mercadopago/review'
import { ParsePreview, type ParsePreviewConfirmPayload } from '@/components/dashboard/ParsePreview'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'
import type { Account, Card } from '@/types/database'
import { getMercadoPagoReviewPresentation, formatMercadoPagoObservedDate as formatObservedDate } from '@/lib/mercadopago/review-presentation'

type State = {
  movements: MercadoPagoMovement[]
  aggregates: Record<string, number>
}

type AccountLink = { linkedAccountId: string | null; linkedAccountVersion: number; accounts: Array<Pick<Account, 'id' | 'name' | 'type'>> }

type ReviewInboxProps = {
  buckets: ReturnType<typeof classifyMercadoPagoMovements>
  selectionMode?: boolean
  onEnterSelection?: () => void
  onCancelSelection?: () => void
  selectedIds?: Set<string>
  onToggle?: (movement: MercadoPagoMovement) => void
  onSelectAll?: () => void
  onOpen: (movement: MercadoPagoMovement) => void
  onDismiss?: (movement: MercadoPagoMovement, triggerElement?: HTMLElement) => void
  onBulkDismiss?: () => void
  cutoff?: string
  onCutoffChange?: (value: string) => void
}

function formatMoney(movement: MercadoPagoMovement) {
  const amount = getMercadoPagoDisplayAmount(movement)
  if (typeof amount.value !== 'number' || !Number.isFinite(amount.value)) return '—'

  try {
    if (amount.currency && /^[A-Z]{3}$/.test(amount.currency)) {
      return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: amount.currency,
      }).format(Math.abs(amount.value))
    }
    return new Intl.NumberFormat('es-AR').format(Math.abs(amount.value))
  } catch {
    return String(Math.abs(amount.value))
  }
}

export function getMercadoPagoFundingSourceLabel(movement: MercadoPagoMovement) {
  if (movement.fundingSource?.kind === 'mercadopago_balance') {
    return 'Saldo de Mercado Pago'
  }
  if (movement.fundingSource?.kind === 'card') {
    return `${movement.fundingSource.brand || 'Tarjeta'}${
      movement.fundingSource.lastFour
        ? ` · •••• ${movement.fundingSource.lastFour}`
        : ''
    }`
  }
  return 'Medio de pago no identificado'
}


type MercadoPagoReviewDetailProps = {
  movement: MercadoPagoMovement
}

export function MercadoPagoReviewDetail({ movement }: MercadoPagoReviewDetailProps) {
  const presentation = getMercadoPagoReviewPresentation(movement)

  return (
    <div className="space-y-4">
      <section className="rounded-input border border-border-subtle bg-primary/[0.03] p-4">
        <p className="type-micro text-text-secondary">DESDE MERCADO PAGO</p>
        <p className="mt-3 text-sm font-semibold">
          {getDisplayExpenseDescription(movement) || 'Operación de Mercado Pago'}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {formatMoney(movement)} · {formatObservedDate(getMercadoPagoReviewDate(movement))} · {getMercadoPagoFundingSourceLabel(movement)}
        </p>
      </section>
      <div>
        <h3 className="font-semibold text-text-primary">{presentation.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">{presentation.explanation}</p>
      </div>
      <p className="rounded-input bg-bg-secondary p-3 text-sm font-semibold text-text-secondary">
        Esta operación todavía no se puede confirmar.
      </p>
    </div>
  )
}

export function MercadoPagoReviewInbox({ buckets, selectionMode = false, onEnterSelection = () => undefined, onCancelSelection = () => undefined, selectedIds = new Set(), onToggle = () => undefined, onSelectAll = () => undefined, onOpen, onBulkDismiss = () => undefined, cutoff = '', onCutoffChange = () => undefined }: ReviewInboxProps) {
  const pendingCount = pendingMercadoPagoReviewBucketCount(buckets)
  const movements = sortMercadoPagoPendingMovements([...buckets.eligible, ...buckets.cardPending, ...buckets.unknown])
  const visibleSelected = movements.filter((movement) => selectedIds.has(movement.candidateId)).length

  const groups = [
    { title: 'Para completar', description: 'Podés revisar y completar estos movimientos antes de confirmarlos.', items: movements.filter((movement) => getMercadoPagoReviewPresentation(movement).ready) },
    { title: 'Necesitan más información', description: 'Estos movimientos siguen pendientes. Te explicamos qué falta en cada uno.', items: movements.filter((movement) => !getMercadoPagoReviewPresentation(movement).ready) },
  ]

  return (
    <>
      <section className="mt-6 border-b border-border-subtle pb-4">
        <p className="text-xs font-semibold text-text-secondary">Pendientes</p>
        <p className="mt-1 text-2xl font-extrabold text-text-primary">{pendingCount}</p>
        <p className="mt-1 text-xs text-text-tertiary">Ordenadas por fecha, con el importe y el medio de pago.</p>
      </section>

      <section className="mt-7" aria-labelledby="pending-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="pending-title" className="text-lg font-bold">Tus movimientos pendientes</h2>
          {selectionMode ? <button type="button" onClick={onCancelSelection} className="min-h-11 rounded-button border border-border-subtle px-3 text-sm font-semibold">Cancelar</button> : <details className="text-xs text-text-secondary"><summary className="cursor-pointer py-3">Opciones avanzadas</summary><button type="button" onClick={onEnterSelection} className="min-h-11 rounded-button border border-border-subtle px-3 text-sm font-semibold">Seleccionar operaciones</button></details>}
        </div>
        <p className="mt-1 text-sm text-text-secondary">Revisá cualquier operación para ver su detalle.</p>
        {selectionMode && <div className="mt-4 rounded-card border border-border-subtle bg-bg-secondary p-4">
          <label className="block text-sm font-semibold" htmlFor="mp-cutoff">Seleccionar por fecha</label>
          <p className="mt-1 text-xs text-text-secondary">Hasta esta fecha (inclusive)</p>
          <div className="mt-2 flex gap-2">
            <input id="mp-cutoff" type="date" value={cutoff} onChange={(event) => onCutoffChange(event.target.value)} className="min-h-11 flex-1 rounded-input border border-border-subtle bg-white px-3 text-sm" />
            <button type="button" onClick={onSelectAll} disabled={!cutoff} className="min-h-11 rounded-button border border-border-subtle px-3 text-xs font-semibold disabled:opacity-50">Aplicar</button>
          </div>
          <p className="mt-2 text-xs text-text-secondary">{visibleSelected} seleccionada{visibleSelected === 1 ? '' : 's'}</p>
          <button type="button" onClick={onBulkDismiss} disabled={visibleSelected === 0} className="mt-3 min-h-11 w-full rounded-button bg-danger px-3 py-3 text-sm font-semibold text-white disabled:opacity-50">Desestimar seleccionadas</button>
          <p className="mt-2 text-xs text-text-secondary">Se desestiman sólo las operaciones seleccionadas. No se registran como gastos.</p>
        </div>}
        <div className="mt-3 space-y-3">
          {groups.filter((group) => group.items.length > 0).map((group) => <section key={group.title} aria-label={group.title} className="space-y-3 pt-3">
            <h3 className="font-bold text-text-primary">{group.title} · {group.items.length}</h3>
            <p className="text-xs text-text-secondary">{group.description}</p>
            {group.items.map((movement) => (
            <article key={movement.candidateId} className="card-s5 flex min-h-20 items-start gap-3 p-4">
              {selectionMode && <label className="-my-2 -ml-2 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center"><input type="checkbox" aria-label={`Seleccionar ${getDisplayExpenseDescription(movement) || 'operación'}`} checked={selectedIds.has(movement.candidateId)} onChange={() => onToggle(movement)} className="h-5 w-5 accent-primary" /></label>}
              <button type="button" onClick={() => onOpen(movement)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Wallet size={19} /></span>
                <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="min-w-0 font-bold">{getDisplayExpenseDescription(movement) || 'Operación de Mercado Pago'}</span><span className="type-amount-sm shrink-0 whitespace-nowrap text-text-primary">{formatMoney(movement)}</span></span><span className="mt-1 block text-xs text-text-secondary">{formatObservedDate(getMercadoPagoReviewDate(movement))} · {getMercadoPagoFundingSourceLabel(movement)}</span><span className="mt-2 block text-xs leading-relaxed text-text-secondary">{getMercadoPagoReviewPresentation(movement).explanation}</span><span className="mt-2 block text-xs font-semibold text-primary">{getMercadoPagoReviewPresentation(movement).action}</span></span>
              </button>
            </article>
            ))}
          </section>)}
          {pendingCount === 0 && <p className="rounded-card bg-bg-secondary p-4 text-sm text-text-secondary">No hay operaciones pendientes para revisar.</p>}
        </div>
      </section>
    </>
  )
}

export function MercadoPagoReviewClient() {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MercadoPagoMovement | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [cardsLoading, setCardsLoading] = useState(false)
  const [cardsError, setCardsError] = useState(false)
  const [accountLink, setAccountLink] = useState<AccountLink | null>(null)
  const [accountLinkLoading, setAccountLinkLoading] = useState(false)
  const [accountLinkError, setAccountLinkError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmationNotice, setConfirmationNotice] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<MercadoPagoMovement | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkPreview, setBulkPreview] = useState<MercadoPagoMovement[] | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [cutoff, setCutoff] = useState('')
  const [dismissing, setDismissing] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [dismissError, setDismissError] = useState(false)
  const [aliasLoading, setAliasLoading] = useState(false)
  const [aliasMatch, setAliasMatch] = useState<CounterpartyAliasMatch | null>(null)
  const dismissTriggerRef = useRef<HTMLElement | null>(null)
  const dismissingRef = useRef(false)
  const movementsRequest = useRef(0)
  const accountsRequest = useRef(0)
  const cardsRequest = useRef(0)
  const selectionRequest = useRef(0)

  const load = useCallback(async () => {
    const request = ++movementsRequest.current
    setLoading(true)
    setError(false)

    try {
      const response = await fetch('/api/integrations/mercadopago/movements', {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('mercadopago movements failed')
      const nextState = (await response.json()) as State
      if (request === movementsRequest.current) {
        setState(nextState)
        setSelectedIds((current) => new Set([...current].filter((id) => nextState.movements.some((movement) => movement.candidateId === id && movement.reviewStatus === 'pending'))))
      }
    } catch {
      if (request === movementsRequest.current) setError(true)
    } finally {
      if (request === movementsRequest.current) setLoading(false)
    }
  }, [])

  const resetReview = useCallback(() => {
    accountsRequest.current += 1
    cardsRequest.current += 1
    selectionRequest.current += 1
    setSelected(null)
    setAccounts([])
    setAccountLink(null)
    setAccountLinkError(false)
    setAccountLinkLoading(false)
    setAliasMatch(null)
    setAliasLoading(false)
  }, [])

  const loadAccounts = useCallback(async () => {
    const request = ++accountsRequest.current
    setAccounts([])
    setAccountLink(null)
    setAccountLinkError(false)
    setAccountLinkLoading(true)

    try {
      const response = await fetch('/api/integrations/mercadopago/account-link', {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('accounts failed')
      const link = (await response.json()) as AccountLink
      if (request !== accountsRequest.current) return
      setAccountLink(link)
      setAccounts(link.accounts as Account[])
    } catch {
      if (request === accountsRequest.current) {
        setAccounts([])
        setAccountLink(null)
        setAccountLinkError(true)
      }
    } finally {
      if (request === accountsRequest.current) setAccountLinkLoading(false)
    }
  }, [])

  const loadCards = useCallback(async () => {
    const request = ++cardsRequest.current
    setCards([])
    setCardsLoading(true)
    setCardsError(false)
    try {
      const response = await fetch('/api/cards', { cache: 'no-store' })
      if (!response.ok) throw new Error('cards unavailable')
      const loaded = await response.json() as Card[]
      if (request !== cardsRequest.current) return
      setCards(loaded.filter((card) => !card.archived))
    } catch {
      if (request !== cardsRequest.current) return
      setCards([])
      setCardsError(true)
    } finally { if (request === cardsRequest.current) setCardsLoading(false) }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      movementsRequest.current += 1
      accountsRequest.current += 1
      cardsRequest.current += 1
      selectionRequest.current += 1
    }
  }, [load])

  const open = (movement: MercadoPagoMovement) => {
    const request = ++selectionRequest.current
    setSelected(movement)
    setConfirmationNotice(null)
    setAliasMatch(null)
    setAliasLoading(false)
    if (isReviewableMercadoPagoExpense(movement) || isReviewableMercadoPagoCardPurchase(movement)) {
      if (isReviewableMercadoPagoExpense(movement)) void loadAccounts()
      else void loadCards()
      setAliasLoading(true)
      void fetch('/api/counterparty-aliases/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias_value: getInitialExpenseDescription(movement) }),
      }).then(async (response) => {
        if (!response.ok) return null
        const body = await response.json() as { match?: CounterpartyAliasMatch | null }
        return body.match ?? null
      }).then((match) => { if (request === selectionRequest.current) setAliasMatch(match) }).catch(() => undefined).finally(() => { if (request === selectionRequest.current) setAliasLoading(false) })
    }
  }

  const confirm = async (payload: ParsePreviewConfirmPayload) => {
    const isCardPurchase = Boolean(selected && isReviewableMercadoPagoCardPurchase(selected))
    if (!selected || (!isReviewableMercadoPagoExpense(selected) && !isCardPurchase)) throw new Error('ineligible')
    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/integrations/mercadopago/movements/${encodeURIComponent(selected.candidateId)}/confirm-expense`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildConfirmExpensePayload({
            description: payload.description,
            category: payload.category,
            isWant: payload.is_want === true,
            expectedLinkedAccountId: accountLink?.linkedAccountId ?? '',
            expectedLinkedAccountVersion: accountLink?.linkedAccountVersion ?? -1,
            ...(isCardPurchase ? { cardId: payload.card_id ?? '', installments: payload.installments } : {}),
          })),
        },
      )
      if (!response.ok) {
        if (response.status === 409 || response.status === 404) {
          resetReview()
          await load()
          setConfirmationNotice('La operación o su vínculo cambió. Actualizamos la bandeja; revisala de nuevo antes de confirmar.')
        } else {
          setConfirmationNotice('No pudimos confirmar el movimiento. Revisá los datos y reintentá.')
        }
        throw new Error('confirmation failed')
      }
      const result: unknown = await response.json()
      setConfirmationNotice('Movimiento registrado desde Mercado Pago. Podés editarlo desde Movimientos.')
      resetReview()
      await load()
      return result
    } catch {
      throw new Error('confirmation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const dismiss = async () => {
    if (!dismissed || dismissingRef.current) return
    dismissingRef.current = true
    setDismissing(true)
    setDismissError(false)
    try {
      const response = await fetch(`/api/integrations/mercadopago/movements/${encodeURIComponent(dismissed.candidateId)}/dismiss`, { method: 'POST' })
      if (!response.ok) throw new Error('dismissal failed')
      resetReview()
      setDismissed(null)
      await load()
    } catch {
      setDismissError(true)
    } finally {
      dismissingRef.current = false
      setDismissing(false)
    }
  }

  const requestDismissal = (movement: MercadoPagoMovement, triggerElement?: HTMLElement) => {
    if (dismissing) return
    dismissTriggerRef.current = triggerElement ?? null
    setDismissError(false)
    setDismissed(movement)
  }

  const requestBulkDismissal = () => {
    const movements = sortMercadoPagoPendingMovements(state?.movements ?? []).filter((movement) => selectedIds.has(movement.candidateId))
    if (movements.length > 0) {
      setBulkError(null)
      setBulkPreview(movements)
    }
  }

  const bulkDismiss = async () => {
    if (!bulkPreview || bulkBusy) return
    setBulkBusy(true)
    setBulkError(null)
    try {
      const response = await fetch('/api/integrations/mercadopago/movements/bulk-dismiss', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: bulkPreview.map((movement) => ({ candidateId: movement.candidateId, snapshot: movement.reviewSnapshot })) }),
      })
      const body = await response.json() as { results?: Array<{ candidateId: string; status: string }> }
      if (!response.ok || !body.results) throw new Error('bulk dismissal failed')
      const successes = body.results.filter((result) => result.status === 'dismissed' || result.status === 'already_dismissed').map((result) => result.candidateId)
      const failures = body.results.filter((result) => result.status !== 'dismissed' && result.status !== 'already_dismissed')
      setSelectedIds((current) => new Set([...current].filter((id) => !successes.includes(id))))
      if (successes.length > 0) await load()
      if (failures.length > 0) setBulkError(`${successes.length} desestimada${successes.length === 1 ? '' : 's'}; ${failures.length} quedó${failures.length === 1 ? '' : 'aron'} sin cambios para revisar.`)
      if (successes.length > 0 || failures.length === 0) setBulkPreview(null)
    } catch {
      setBulkError('No pudimos desestimar el lote. Las operaciones siguen seleccionadas y pendientes.')
    } finally { setBulkBusy(false) }
  }

  const buckets = classifyMercadoPagoMovements(state?.movements ?? [])
  const pendingMovements = sortMercadoPagoPendingMovements([...buckets.eligible, ...buckets.cardPending, ...buckets.unknown])
  const toggleSelection = (movement: MercadoPagoMovement) => setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(movement.candidateId)) next.delete(movement.candidateId)
    else next.add(movement.candidateId)
    return next
  })
  const selectBeforeCutoff = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) return
    setSelectedIds(new Set(selectMovementsOnOrBefore(pendingMovements, cutoff).map((movement) => movement.candidateId)))
  }

  const cancelSelection = () => {
    setSelectionMode(false)
    setSelectedIds(new Set())
    setCutoff('')
  }

  return (
    <main className="mx-auto min-h-app max-w-md bg-bg-primary px-5 pb-28 pt-[max(20px,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <Link
          href="/settings"
          aria-label="Volver a configuración"
          className="grid h-11 w-11 place-items-center rounded-full text-text-secondary hover:bg-primary-soft"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <p className="type-micro text-primary">MERCADO PAGO</p>
          <h1 className="type-title text-text-primary">Revisar operaciones</h1>
        </div>
      </header>
      <p className="mt-3 text-sm leading-relaxed text-text-secondary">
        Los movimientos todavía requieren tu confirmación. Completá los que tienen información suficiente y revisá qué falta en los demás.
      </p>

      {confirmationNotice && <p role="status" className="mt-4 rounded-input bg-primary-soft p-3 text-sm text-text-primary">{confirmationNotice} <Link href="/movimientos" className="font-semibold text-primary underline">Ver movimientos</Link></p>}

      {loading && (
        <p role="status" className="mt-10 text-center text-sm text-text-secondary">
          Cargando operaciones…
        </p>
      )}

      {error && (
        <div role="alert" className="mt-6 rounded-card border border-danger/20 bg-danger-soft p-4">
          <p className="font-bold">No pudimos cargar las operaciones.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-button bg-primary px-4 text-sm font-semibold text-white"
          >
            <ArrowClockwise size={16} />
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && state && (
        <MercadoPagoReviewInbox
          buckets={buckets}
          selectionMode={selectionMode}
          onEnterSelection={() => setSelectionMode(true)}
          onCancelSelection={cancelSelection}
          selectedIds={selectedIds}
          onToggle={toggleSelection}
          onSelectAll={selectBeforeCutoff}
          onOpen={open}
          onBulkDismiss={requestBulkDismissal}
          cutoff={cutoff}
          onCutoffChange={setCutoff}
        />
      )}

      {bulkError && <p role="alert" className="mt-4 rounded-input bg-danger-soft p-3 text-sm text-danger">{bulkError}</p>}

      <ConfirmationSurface
        open={bulkPreview !== null}
        onClose={() => { if (!bulkBusy) setBulkPreview(null) }}
        onConfirm={() => void bulkDismiss()}
        title="Desestimar operaciones seleccionadas"
        description={`${bulkPreview?.length ?? 0} operación${bulkPreview?.length === 1 ? '' : 'es'} seleccionada${bulkPreview?.length === 1 ? '' : 's'}. Se desestiman sólo las operaciones seleccionadas. No se registran como gastos.`}
        confirmLabel="Confirmar desestimación"
        destructive
        busy={bulkBusy}
        appearance="compact"
      >
        <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {bulkPreview?.map((movement) => <p key={movement.candidateId} className="border-b border-border-subtle pb-2">{getDisplayExpenseDescription(movement) || 'Operación de Mercado Pago'} · {formatMoney(movement)} · {formatObservedDate(getMercadoPagoReviewDate(movement))}</p>)}
        </div>
      </ConfirmationSurface>

      <ConfirmationSurface
        open={dismissed !== null}
        onClose={() => { if (!dismissing) setDismissed(null) }}
        onConfirm={() => void dismiss()}
        triggerElement={dismissTriggerRef.current}
        title="Desestimar operación"
        description="Esta decisión queda guardada y la operación no se incorpora a tus movimientos financieros."
        confirmLabel="Desestimar"
        destructive
        busy={dismissing}
        appearance="compact"
      >
        <p>{dismissed ? `${getDisplayExpenseDescription(dismissed) || 'Operación de Mercado Pago'} · ${formatMoney(dismissed)}` : ''}</p>
        {dismissError && <p role="alert" className="mt-3 text-danger">No pudimos desestimar la operación. La bandeja no cambió.</p>}
      </ConfirmationSurface>

      <TaskSurface
        open={selected !== null && !isReviewableMercadoPagoExpense(selected) && !isReviewableMercadoPagoCardPurchase(selected)}
        onClose={() => {
          if (!dismissing) resetReview()
        }}
        eyebrow="MERCADO PAGO"
        title="Revisar operación"
        description="Te explicamos qué falta para resolver este movimiento. Podés dejarlo pendiente o desestimarlo."
        appearance="compact"
        canvasTone="standard"
        footer={(
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetReview}
              className="min-h-11 flex-1 rounded-button border border-border-subtle px-3 py-3 text-sm font-semibold"
            >
              Mantener pendiente
            </button>
            <button
              type="button"
              onClick={(event) => selected && requestDismissal(selected, event.currentTarget)}
              disabled={dismissing || dismissed !== null}
              className="min-h-11 flex-1 rounded-button border border-danger/30 px-3 py-3 text-sm font-semibold text-danger disabled:opacity-50"
            >
              Desestimar
            </button>
          </div>
        )}
      >
        {selected && <MercadoPagoReviewDetail movement={selected} />}
      </TaskSurface>

      <TaskSurface
        open={selected !== null && (isReviewableMercadoPagoExpense(selected) || isReviewableMercadoPagoCardPurchase(selected))}
        onClose={() => {
          if (!submitting) resetReview()
        }}
        eyebrow="MERCADO PAGO"
        title={selected && isReviewableMercadoPagoCardPurchase(selected) ? 'Confirmar compra con tarjeta' : 'Confirmar gasto'}
        description={selected && isReviewableMercadoPagoCardPurchase(selected) ? 'Compra aprobada en Mercado Pago. Elegí la tarjeta para registrarla; esta compra no representa un débito del saldo.' : 'Revisá qué representa esta salida de saldo. Podés corregir el nombre y elegir la categoría antes de registrarla como gasto.'}
        appearance="compact"
        canvasTone="standard"
        footer={(
          <button type="button" onClick={(event) => selected && requestDismissal(selected, event.currentTarget)} disabled={dismissing || dismissed !== null} className="min-h-11 w-full rounded-button border border-danger/30 px-3 py-3 text-sm font-semibold text-danger disabled:opacity-50">
            Desestimar operación
          </button>
        )}
      >
        {aliasLoading && <p role="status" className="text-sm text-text-secondary">Buscando tus preferencias para este comercio…</p>}
        {selected && !isReviewableMercadoPagoCardPurchase(selected) && accountLinkLoading && <p role="status" className="text-sm text-text-secondary">Cargando vínculo de cuenta…</p>}
        {selected && !isReviewableMercadoPagoCardPurchase(selected) && accountLinkError && <div role="alert" className="space-y-3"><p className="rounded-input bg-danger-soft p-3 text-sm text-danger">No pudimos validar el vínculo de cuenta. Reintentá antes de confirmar.</p><button type="button" onClick={() => void loadAccounts()} className="inline-flex min-h-11 items-center rounded-button border border-border-subtle px-4 text-sm font-semibold">Reintentar</button></div>}
        {selected && !isReviewableMercadoPagoCardPurchase(selected) && !accountLinkLoading && !accountLinkError && !accountLink?.linkedAccountId && <div className="space-y-3"><p className="rounded-input bg-warning/10 p-3 text-sm text-text-secondary">Para confirmar un débito de saldo, primero elegí la cuenta que representa tu saldo de Mercado Pago.</p><Link href="/settings" className="inline-flex min-h-11 items-center rounded-button bg-primary px-4 text-sm font-semibold text-white">Configurar vínculo</Link></div>}
        {selected && isReviewableMercadoPagoCardPurchase(selected) && cardsLoading && <p role="status" className="text-sm text-text-secondary">Cargando tus tarjetas…</p>}
        {selected && isReviewableMercadoPagoCardPurchase(selected) && cardsError && <div role="alert" className="space-y-3"><p className="rounded-input bg-danger-soft p-3 text-sm text-danger">No pudimos cargar tus tarjetas. No se puede confirmar todavía.</p><button type="button" onClick={() => void loadCards()} className="min-h-11 rounded-button border border-border-subtle px-4 text-sm font-semibold">Reintentar</button></div>}
        {selected && isReviewableMercadoPagoCardPurchase(selected) && !cardsLoading && !cardsError && cards.length === 0 && <p className="rounded-input bg-warning/10 p-3 text-sm text-text-secondary">No hay tarjetas activas para elegir. La compra sigue pendiente.</p>}
        {selected && isReviewableMercadoPagoCardPurchase(selected) && !cardsLoading && !cardsError && cards.length > 0 && !aliasLoading && <ParsePreview
          key={`${selected.candidateId}:${cards.length}:${aliasMatch?.profile_id ?? 'none'}:credit`}
          data={{ amount: selected.amount.value!, currency: selected.amount.currency as 'ARS' | 'USD', category: aliasMatch?.default_category === 'Pago de Tarjetas' ? '' : aliasMatch?.default_category ?? '', description: getInitialExpenseDescription(selected), is_want: false, payment_method: 'CREDIT', card_id: null, installments: 1, date: selected.occurredAt ?? '', detected_alias: getInitialExpenseDescription(selected), alias_match: aliasMatch }}
          cards={cards} accounts={[]} onConfirm={confirm} onSave={() => undefined} onCancel={resetReview}
          aliasSource="mercadopago" confirmLabel="Registrar compra" immutableProviderEvidence embedded
        />}
        {selected && !isReviewableMercadoPagoCardPurchase(selected) && !accountLinkLoading && !accountLinkError && accountLink?.linkedAccountId && !aliasLoading && <ParsePreview
          key={`${selected.candidateId}:${accounts.length}:${aliasMatch?.profile_id ?? 'none'}`}
          data={{
            amount: Math.abs(selected.balanceImpact.amount.value ?? 0),
            currency: selected.balanceImpact.amount.currency === 'USD' ? 'USD' : 'ARS',
            category: aliasMatch?.default_category ?? '',
            description: getInitialExpenseDescription(selected),
            is_want: false,
            payment_method: 'DEBIT',
            card_id: null,
            date: selected.balanceOccurredAt ?? '',
            detected_alias: getInitialExpenseDescription(selected),
            alias_match: aliasMatch,
          }}
          cards={[]}
          accounts={accounts}
          fixedAccount={accountLink?.linkedAccountId ? accountLink.accounts.find((account) => account.id === accountLink.linkedAccountId) ?? null : null}
          onConfirm={confirm}
          onSave={() => undefined}
          onCancel={resetReview}
          aliasSource="mercadopago"
          confirmLabel="Registrar gasto"
          immutableProviderEvidence
          embedded
        />}
      </TaskSurface>
    </main>
  )
}
