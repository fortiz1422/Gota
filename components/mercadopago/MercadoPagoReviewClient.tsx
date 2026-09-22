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
  isReviewableMercadoPagoExpense,
  sortMercadoPagoPendingMovements,
  type MercadoPagoMovement,
} from '@/lib/mercadopago/review'
import { ParsePreview, type ParsePreviewConfirmPayload } from '@/components/dashboard/ParsePreview'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'

type Account = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'digital'
  archived?: boolean
}

type State = {
  movements: MercadoPagoMovement[]
  aggregates: Record<string, number>
}

type ReviewInboxProps = {
  buckets: ReturnType<typeof classifyMercadoPagoMovements>
  onOpen: (movement: MercadoPagoMovement) => void
  onDismiss: (movement: MercadoPagoMovement, triggerElement?: HTMLElement) => void
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

function formatObservedDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Sin fecha'
  return new Date(value).toLocaleDateString('es-AR')
}

export function getMercadoPagoFundingSourceLabel(movement: MercadoPagoMovement) {
  if (movement.fundingSource?.kind === 'mercadopago_balance') {
    return 'Saldo de Mercado Pago'
  }
  if (movement.fundingSource?.kind === 'card') {
    return `Pagado con tarjeta${
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
  const isCard = movement.fundingSource?.kind === 'card'

  return (
    <div className="space-y-4">
      <section className="rounded-input border border-border-subtle bg-primary/[0.03] p-4">
        <p className="type-micro text-text-secondary">EVIDENCIA OBSERVADA</p>
        <p className="mt-3 text-sm font-semibold">
          {getDisplayExpenseDescription(movement) || 'Operación de Mercado Pago'}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          {formatMoney(movement)} · {formatObservedDate(movement.occurredAt)} · {getMercadoPagoFundingSourceLabel(movement)}
        </p>
      </section>
      <p className="text-sm text-text-secondary">
        {isCard
          ? 'Falta elegir tarjeta y ciclo para poder registrar esta operación.'
          : 'No hay evidencia suficiente para registrarla automáticamente.'}
      </p>
      <p className="rounded-input bg-bg-secondary p-3 text-sm font-semibold text-text-secondary">
        Esta operación todavía no se puede confirmar.
      </p>
    </div>
  )
}

export function MercadoPagoReviewInbox({ buckets, onOpen, onDismiss }: ReviewInboxProps) {
  const pendingCount = pendingMercadoPagoReviewBucketCount(buckets)
  const movements = sortMercadoPagoPendingMovements([...buckets.eligible, ...buckets.cardPending, ...buckets.unknown])

  return (
    <>
      <section className="card-s5 mt-6 p-4">
        <p className="text-xs font-semibold text-text-secondary">Pendientes</p>
        <p className="mt-1 text-2xl font-extrabold text-text-primary">{pendingCount}</p>
        <p className="mt-1 text-xs text-text-tertiary">Una lista cronológica · confirmables {buckets.eligible.length} · sólo evidencia {buckets.cardPending.length + buckets.unknown.length}</p>
      </section>

      <section className="mt-7" aria-labelledby="pending-title">
        <h2 id="pending-title" className="text-lg font-bold">Todas las operaciones pendientes</h2>
        <p className="mt-1 text-sm text-text-secondary">Ordenadas por fecha observada. Revisá cada una; las no confirmables quedan sólo como evidencia.</p>
        <div className="mt-3 space-y-3">
          {movements.map((movement) => (
            <article key={movement.candidateId} className="card-s5 flex min-h-20 items-start gap-3 p-4">
              <button type="button" onClick={() => onOpen(movement)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Wallet size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block font-bold">{getDisplayExpenseDescription(movement) || 'Operación de Mercado Pago'}</span><span className="mt-1 block text-xs text-text-secondary">{formatMoney(movement)} · {formatObservedDate(movement.occurredAt ?? movement.balanceOccurredAt)} · {getMercadoPagoFundingSourceLabel(movement)}</span><span className="mt-2 block text-xs font-semibold text-primary">Revisar</span></span>
              </button>
              <button type="button" onClick={(event) => onDismiss(movement, event.currentTarget)} className="min-h-11 shrink-0 rounded-button border border-danger/30 px-3 text-xs font-semibold text-danger">Desestimar</button>
            </article>
          ))}
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
  const [submitting, setSubmitting] = useState(false)
  const [dismissed, setDismissed] = useState<MercadoPagoMovement | null>(null)
  const [dismissing, setDismissing] = useState(false)
  const [dismissError, setDismissError] = useState(false)
  const [aliasMatch, setAliasMatch] = useState<CounterpartyAliasMatch | null>(null)
  const dismissTriggerRef = useRef<HTMLElement | null>(null)
  const dismissingRef = useRef(false)
  const movementsRequest = useRef(0)
  const accountsRequest = useRef(0)

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
      if (request === movementsRequest.current) setState(nextState)
    } catch {
      if (request === movementsRequest.current) setError(true)
    } finally {
      if (request === movementsRequest.current) setLoading(false)
    }
  }, [])

  const resetReview = useCallback(() => {
    accountsRequest.current += 1
    setSelected(null)
    setAccounts([])
    setAliasMatch(null)
  }, [])

  const loadAccounts = useCallback(async () => {
    const request = ++accountsRequest.current
    setAccounts([])

    try {
      const response = await fetch('/api/accounts?include_archived=false', {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('accounts failed')
      const nextAccounts = (await response.json()) as Account[]
      if (request !== accountsRequest.current) return
      setAccounts(
        nextAccounts.filter(
          (account) =>
            !account.archived &&
            ['cash', 'bank', 'digital'].includes(account.type),
        ),
      )
    } catch {
      if (request === accountsRequest.current) setAccounts([])
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      movementsRequest.current += 1
      accountsRequest.current += 1
    }
  }, [load])

  const open = (movement: MercadoPagoMovement) => {
    setSelected(movement)
    setAliasMatch(null)
    if (isReviewableMercadoPagoExpense(movement)) {
      void loadAccounts()
      void fetch('/api/counterparty-aliases/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias_value: getInitialExpenseDescription(movement) }),
      }).then(async (response) => {
        if (!response.ok) return null
        const body = await response.json() as { match?: CounterpartyAliasMatch | null }
        return body.match ?? null
      }).then((match) => setAliasMatch(match)).catch(() => undefined)
    }
  }

  const confirm = async (payload: ParsePreviewConfirmPayload) => {
    if (!selected || !isReviewableMercadoPagoExpense(selected)) throw new Error('ineligible')
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
            accountId: payload.account_id ?? '',
          })),
        },
      )
      if (!response.ok) throw new Error('confirmation failed')
      const next = sortMercadoPagoPendingMovements(
        (state?.movements ?? []).filter((movement) => movement.candidateId !== selected.candidateId),
      )[0]
      resetReview()
      await load()
      if (next) open(next)
      return await response.json()
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

  const buckets = classifyMercadoPagoMovements(state?.movements ?? [])

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
        Revisá las operaciones observadas antes de incorporarlas a tu registro.
      </p>

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
        <MercadoPagoReviewInbox buckets={buckets} onOpen={open} onDismiss={requestDismissal} />
      )}

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
        open={selected !== null && !isReviewableMercadoPagoExpense(selected)}
        onClose={() => {
          if (!dismissing) resetReview()
        }}
        eyebrow="MERCADO PAGO"
        title="Revisar operación"
        description="Revisá la evidencia disponible y decidí si querés mantenerla pendiente o desestimarla."
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
        open={selected !== null && isReviewableMercadoPagoExpense(selected)}
        onClose={() => {
          if (!submitting) resetReview()
        }}
        eyebrow="MERCADO PAGO"
        title="Confirmar gasto"
        description="Completá los datos para registrar este débito observado."
        appearance="compact"
        canvasTone="standard"
      >
        {selected && <ParsePreview
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
          onConfirm={confirm}
          onSave={() => undefined}
          onCancel={resetReview}
          aliasSource="mercadopago"
          immutableProviderEvidence
          embedded
        />}
      </TaskSurface>
    </main>
  )
}
