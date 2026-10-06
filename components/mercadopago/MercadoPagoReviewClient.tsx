'use client'

import { MercadoPagoDuplicateReview, type MercadoPagoDuplicateChoice } from './MercadoPagoDuplicateReview'
import { CATEGORIES } from '@/lib/validation/schemas'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowClockwise,
  CheckCircle,
  DotsThree,
  CaretRight,
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
  isReviewableMercadoPagoWalletPayment,
  isReviewableMercadoPagoCardPurchase,
  sortMercadoPagoPendingMovements,
  type MercadoPagoMovement,
  selectMovementsOnOrBefore,
} from '@/lib/mercadopago/review'
import { ParsePreview, type ParsePreviewConfirmPayload } from '@/components/dashboard/ParsePreview'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'
import type { Account, Card } from '@/types/database'
import { getMercadoPagoReviewPresentation, formatMercadoPagoObservedDate as formatObservedDate } from '@/lib/mercadopago/review-presentation'
import { matchMercadoPagoCard } from '@/lib/mercadopago/card-matcher'

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
    return 'Saldo MP'
  }
  if (movement.fundingSource?.kind === 'card') {
    return `${movement.fundingSource.brand || 'Tarjeta'}${
      movement.fundingSource.lastFour
        ? ` · •••• ${movement.fundingSource.lastFour}`
        : ''
    }`
  }
  return 'Medio por identificar'
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

  if (pendingCount === 0) return (
    <section className="mt-12 rounded-card border border-border-subtle bg-bg-secondary/50 px-6 py-10 text-center" aria-label="Sin movimientos pendientes">
      <CheckCircle size={36} weight="light" className="mx-auto text-primary" aria-hidden="true" />
      <h2 className="mt-4 text-lg font-semibold text-text-primary">Estás al día</h2>
      <p className="mt-2 text-sm text-text-secondary">No hay movimientos pendientes de revisar.</p>
    </section>
  )

  return (
    <section className="mt-6" aria-labelledby="pending-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pending-title" className="text-sm font-medium text-text-secondary">{pendingCount} {pendingCount === 1 ? 'movimiento para revisar' : 'movimientos para revisar'}</h2>
        {selectionMode ? <button type="button" onClick={onCancelSelection} className="min-h-11 rounded-button px-3 text-sm font-semibold text-text-secondary">Cancelar</button> : (
          <details className="relative">
            <summary aria-label="Acciones de la lista" className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-full text-text-secondary hover:bg-bg-secondary [&::-webkit-details-marker]:hidden"><DotsThree size={24} aria-hidden="true" /></summary>
            <div className="absolute right-0 z-10 w-52 rounded-input border border-border-subtle bg-bg-primary p-1 shadow-lg">
              <button type="button" onClick={onEnterSelection} className="min-h-11 w-full rounded-button px-3 text-left text-sm hover:bg-bg-secondary">Seleccionar movimientos</button>
            </div>
          </details>
        )}
      </div>
      {selectionMode && <div className="mt-3 rounded-card border border-border-subtle bg-bg-secondary p-4">
        <label className="block text-sm font-semibold" htmlFor="mp-cutoff">Seleccionar por fecha</label>
        <p className="mt-1 text-xs text-text-secondary">Hasta esta fecha (inclusive)</p>
        <div className="mt-2 flex gap-2">
          <input id="mp-cutoff" type="date" value={cutoff} onChange={(event) => onCutoffChange(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-input border border-border-subtle bg-bg-primary px-3 text-sm" />
          <button type="button" onClick={onSelectAll} disabled={!cutoff} className="min-h-11 rounded-button border border-border-subtle px-3 text-xs font-semibold disabled:opacity-50">Aplicar</button>
        </div>
        <button type="button" onClick={onBulkDismiss} disabled={visibleSelected === 0} className="mt-3 min-h-11 w-full rounded-button bg-danger px-3 py-3 text-sm font-semibold text-white disabled:opacity-50">Descartar {visibleSelected > 0 ? visibleSelected : ''} seleccionados</button>
        <p className="mt-2 text-xs text-text-secondary">Se retiran de esta lista sin registrar gastos.</p>
      </div>}
      <div className="mt-3 overflow-hidden rounded-card border border-border-subtle divide-y divide-border-subtle">
        {movements.map((movement) => {
          const presentation = getMercadoPagoReviewPresentation(movement)
          const transfer = movement.kind === 'transfer' || movement.operation?.type === 'money_transfer'
          const hint = movement.attention === 'possible_duplicate' ? 'Comparar con un gasto existente'
            : transfer ? movement.direction === 'inflow' ? 'Identificá de dónde vino' : '¿Fue un pago o entre tus cuentas?'
            : presentation.ready && movement.fundingSource?.kind === 'card' ? 'Elegí la tarjeta y categoría'
            : presentation.ready ? 'Revisá la categoría'
            : presentation.title
          return <article key={movement.candidateId} className="flex items-center gap-2 p-4 hover:bg-bg-secondary/50">
            {selectionMode && <label className="-my-2 -ml-2 flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center"><input type="checkbox" aria-label={`Seleccionar ${getDisplayExpenseDescription(movement) || 'operación'}`} checked={selectedIds.has(movement.candidateId)} onChange={() => onToggle(movement)} className="h-5 w-5 accent-primary" /></label>}
            <button type="button" onClick={() => onOpen(movement)} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-primary">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text-primary">{getDisplayExpenseDescription(movement) || (transfer ? 'Transferencia' : 'Movimiento de Mercado Pago')}</span>
                <span className="mt-1 block truncate text-xs text-text-tertiary">{formatObservedDate(getMercadoPagoReviewDate(movement))} · {getMercadoPagoFundingSourceLabel(movement)}{movement.installments && movement.installments > 1 ? ` · ${movement.installments} cuotas` : ''}</span>
                <span className="mt-1.5 block text-xs text-text-secondary">{hint}</span>
              </span>
              <span className="type-amount-sm shrink-0 whitespace-nowrap text-text-primary">{formatMoney(movement)}</span>
              <CaretRight size={14} className="shrink-0 text-text-tertiary" aria-hidden="true" />
            </button>
          </article>
        })}
      </div>
    </section>
  )
}

export function MercadoPagoReviewClient() {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [duplicateChoice, setDuplicateChoice] = useState<MercadoPagoDuplicateChoice | null>(null)
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
  const cardMatch = selected && isReviewableMercadoPagoCardPurchase(selected)
    ? matchMercadoPagoCard(selected.fundingSource, cards)
    : { status: 'insufficient' as const, cardIds: [] as const }
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
    setDuplicateChoice(null)
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
    setDuplicateChoice(null)
    setSelected(movement)
    setConfirmationNotice(null)
    setAliasMatch(null)
    setAliasLoading(false)
    if (movement.attention === 'possible_duplicate') void loadAccounts()
    if (isReviewableMercadoPagoExpense(movement) || isReviewableMercadoPagoWalletPayment(movement) || isReviewableMercadoPagoCardPurchase(movement)) {
      if (isReviewableMercadoPagoExpense(movement) || isReviewableMercadoPagoWalletPayment(movement)) void loadAccounts()
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
    const isWalletPayment = Boolean(selected && isReviewableMercadoPagoWalletPayment(selected))
    if (!selected || (!isReviewableMercadoPagoExpense(selected) && !isWalletPayment && !isCardPurchase)) throw new Error('ineligible')
    setSubmitting(true)
    try {
      const response = await fetch(
        `/api/integrations/mercadopago/movements/${encodeURIComponent(selected.candidateId)}/confirm-expense`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ expectedCandidateFingerprint: selected.reviewSnapshot?.fingerprint, ...(duplicateChoice ? { duplicateResolution: duplicateChoice } : {}), ...buildConfirmExpensePayload({
            description: payload.description,
            category: payload.category,
            isWant: payload.is_want === true,
            expectedLinkedAccountId: accountLink?.linkedAccountId ?? '',
            expectedLinkedAccountVersion: accountLink?.linkedAccountVersion ?? -1,
            ...(isCardPurchase ? { cardId: payload.card_id ?? '', installments: payload.installments } : {}),
          }) }),
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
      return result
    } catch {
      throw new Error('confirmation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const completeConfirmation = (outcome?: { aliasSaved: boolean | null }) => {
    setConfirmationNotice(outcome?.aliasSaved === false
      ? 'Movimiento registrado. No pudimos guardar la preferencia de comercio; podés editarla desde Movimientos.'
      : 'Movimiento registrado desde Mercado Pago. Podés editarlo desde Movimientos.')
    resetReview()
    void load()
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
          <h1 className="type-title text-text-primary">Mercado Pago</h1>
        </div>
      </header>

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
        title="Descartar movimientos"
        description={`${bulkPreview?.length ?? 0} movimientos se retirarán de esta lista. No se registran gastos ni se cambia tu saldo.`}
        confirmLabel="Descartar seleccionados"
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
        open={selected !== null && !isReviewableMercadoPagoExpense(selected) && !isReviewableMercadoPagoWalletPayment(selected) && !isReviewableMercadoPagoCardPurchase(selected)}
        onClose={() => {
          if (!dismissing) resetReview()
        }}
        eyebrow="MERCADO PAGO"
        title="Revisar movimiento"
        description=""
        showIntro={false}
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
        {selected?.attention === 'possible_duplicate' && accountLinkLoading && <p role="status">Validando la cuenta…</p>}
        {selected?.attention === 'possible_duplicate' && accountLinkError && <p role="alert">No pudimos validar tu cuenta. Cerrá el detalle y reintentá.</p>}
        {selected?.attention === 'possible_duplicate' && accountLink?.linkedAccountId && !accountLinkLoading && !accountLinkError && <MercadoPagoDuplicateReview key={selected.candidateId} movement={selected}
          onKeep={(choice) => { setDuplicateChoice(choice); setSelected({ ...selected, attention: undefined }); void loadAccounts() }}
          onLink={async (choice, expense) => {
            const response = await fetch(`/api/integrations/mercadopago/movements/${encodeURIComponent(selected.candidateId)}/confirm-expense`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                description: expense.description.slice(0,100), category: CATEGORIES.includes(expense.category as typeof CATEGORIES[number]) ? expense.category : 'Otros', isWant: expense.is_want,
                expectedCandidateFingerprint: selected.reviewSnapshot?.fingerprint,
                expectedLinkedAccountId: accountLink?.linkedAccountId, expectedLinkedAccountVersion: accountLink?.linkedAccountVersion,
                duplicateResolution: choice,
              }),
            })
            if (!response.ok) throw new Error('link_failed')
            resetReview(); await load(); setConfirmationNotice('Vinculamos el movimiento al gasto existente. No creamos otro gasto.')
          }} />}

      </TaskSurface>

      <TaskSurface
        open={selected !== null && (isReviewableMercadoPagoExpense(selected) || isReviewableMercadoPagoWalletPayment(selected) || isReviewableMercadoPagoCardPurchase(selected))}
        onClose={() => {
          if (!submitting) resetReview()
        }}
        eyebrow="MERCADO PAGO"
        title="Revisar movimiento"
        description=""
        showIntro={false}
        appearance="compact"
        canvasTone="standard"
        footer={(
          <div className="text-center text-sm text-text-secondary">
            <button type="button" onClick={(event) => selected && requestDismissal(selected, event.currentTarget)} disabled={dismissing || dismissed !== null} className="min-h-11 w-full rounded-button px-3 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-danger disabled:opacity-50">
              Desestimar
            </button>
          </div>
        )}
      >
        {selected && <div className="mb-5 pt-5">
          <p className="type-micro text-primary">MERCADO PAGO</p>
          <p className="mt-2 text-base font-semibold leading-snug text-text-primary">{getDisplayExpenseDescription(selected) || 'Operación de Mercado Pago'}</p>
          <p className="mt-1 text-sm text-text-secondary">{formatMoney(selected)} · {formatObservedDate(getMercadoPagoReviewDate(selected))} · {getMercadoPagoFundingSourceLabel(selected)}</p>
        </div>}
        {aliasLoading && <p role="status" className="text-sm text-text-secondary">Buscando tus preferencias para este comercio…</p>}
        {selected && !isReviewableMercadoPagoCardPurchase(selected) && accountLinkLoading && <p role="status" className="text-sm text-text-secondary">Cargando vínculo de cuenta…</p>}
        {selected && !isReviewableMercadoPagoCardPurchase(selected) && accountLinkError && <div role="alert" className="space-y-3"><p className="rounded-input bg-danger-soft p-3 text-sm text-danger">No pudimos validar el vínculo de cuenta. Reintentá antes de confirmar.</p><button type="button" onClick={() => void loadAccounts()} className="inline-flex min-h-11 items-center rounded-button border border-border-subtle px-4 text-sm font-semibold">Reintentar</button></div>}
        {selected && !isReviewableMercadoPagoCardPurchase(selected) && !accountLinkLoading && !accountLinkError && !accountLink?.linkedAccountId && <div className="space-y-3"><p className="rounded-input bg-warning/10 p-3 text-sm text-text-secondary">Para confirmar un débito de saldo, primero elegí la cuenta que representa tu saldo de Mercado Pago.</p><Link href="/settings" className="inline-flex min-h-11 items-center rounded-button bg-primary px-4 text-sm font-semibold text-white">Configurar vínculo</Link></div>}
        {selected && isReviewableMercadoPagoCardPurchase(selected) && cardsLoading && <p role="status" className="text-sm text-text-secondary">Cargando tus tarjetas…</p>}
        {selected && isReviewableMercadoPagoCardPurchase(selected) && cardsError && <div role="alert" className="space-y-3"><p className="rounded-input bg-danger-soft p-3 text-sm text-danger">No pudimos cargar tus tarjetas. No se puede confirmar todavía.</p><button type="button" onClick={() => void loadCards()} className="min-h-11 rounded-button border border-border-subtle px-4 text-sm font-semibold">Reintentar</button></div>}
        {selected && isReviewableMercadoPagoCardPurchase(selected) && !cardsLoading && !cardsError && cards.length === 0 && <div className="space-y-2 rounded-input bg-bg-secondary p-3 text-sm text-text-secondary"><p>No tenés tarjetas activas cargadas en Gota.</p><Link href="/settings" className="inline-flex min-h-11 items-center font-semibold text-primary">Agregar una tarjeta</Link></div>}
        {selected && isReviewableMercadoPagoCardPurchase(selected) && !cardsLoading && !cardsError && cards.length > 0 && !aliasLoading && <ParsePreview
          key={`${selected.candidateId}:${cards.length}:${aliasMatch?.profile_id ?? 'none'}:${cardMatch.status === 'exact' ? cardMatch.cardId : 'manual'}:credit`}
          data={{ amount: selected.cardPurchaseAmount ?? selected.amount.value!, currency: selected.amount.currency as 'ARS' | 'USD', category: aliasMatch?.default_category === 'Pago de Tarjetas' ? '' : aliasMatch?.default_category ?? '', description: getInitialExpenseDescription(selected), is_want: false, payment_method: 'CREDIT', card_id: cardMatch.status === 'exact' ? cardMatch.cardId : null, installments: selected.installments ?? 1, date: selected.occurredAt ?? '', detected_alias: getInitialExpenseDescription(selected), alias_match: aliasMatch }}
          cards={cards} accounts={[]} onConfirm={confirm} onSave={completeConfirmation} onCancel={resetReview}
          aliasSource="mercadopago" confirmLabel="Registrar" immutableProviderEvidence embedded
          cardHelperText={cardMatch.status === 'ambiguous'
            ? 'Encontramos más de una tarjeta compatible. Elegí cuál usaste.'
            : cardMatch.status === 'unmatched'
              ? `No encontramos ${getMercadoPagoFundingSourceLabel(selected)} entre tus tarjetas. Elegí una existente o agregala desde Configuración.`
              : null}
        />}
        {selected && !isReviewableMercadoPagoCardPurchase(selected) && !accountLinkLoading && !accountLinkError && accountLink?.linkedAccountId && !aliasLoading && <ParsePreview
          key={`${selected.candidateId}:${accounts.length}:${aliasMatch?.profile_id ?? 'none'}`}
          data={{
            amount: isReviewableMercadoPagoWalletPayment(selected) ? selected.amount.value! : Math.abs(selected.balanceImpact.amount.value ?? 0),
            currency: (isReviewableMercadoPagoWalletPayment(selected) ? selected.amount.currency : selected.balanceImpact.amount.currency) === 'USD' ? 'USD' : 'ARS',
            category: aliasMatch?.default_category ?? '',
            description: getInitialExpenseDescription(selected),
            is_want: false,
            payment_method: 'DEBIT',
            card_id: null,
            date: (isReviewableMercadoPagoWalletPayment(selected) ? selected.occurredAt : selected.balanceOccurredAt) ?? '',
            detected_alias: getInitialExpenseDescription(selected),
            alias_match: aliasMatch,
          }}
          cards={[]}
          accounts={accounts}
          fixedAccount={accountLink?.linkedAccountId ? accountLink.accounts.find((account) => account.id === accountLink.linkedAccountId) ?? null : null}
          onConfirm={confirm}
          onSave={completeConfirmation}
          onCancel={resetReview}
          aliasSource="mercadopago"
          confirmLabel="Registrar"
          immutableProviderEvidence
          embedded
        />}
      </TaskSurface>
    </main>
  )
}
