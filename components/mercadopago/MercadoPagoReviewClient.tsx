'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowClockwise,
  Bank,
  DeviceMobileSpeaker,
  Wallet,
} from '@phosphor-icons/react'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { ConfirmationSurface } from '@/components/ui/ConfirmationSurface'
import { CATEGORIES } from '@/lib/validation/schemas'
import {
  buildConfirmExpensePayload,
  classifyMercadoPagoMovements,
  pendingMercadoPagoReviewBucketCount,
  getDisplayExpenseDescription,
  getInitialExpenseDescription,
  getMercadoPagoDisplayAmount,
  isReviewableMercadoPagoExpense,
  type MercadoPagoMovement,
} from '@/lib/mercadopago/review'

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

function AccountIcon({ type }: { type: Account['type'] }) {
  if (type === 'cash') return <Wallet size={15} />
  if (type === 'digital') return <DeviceMobileSpeaker size={15} />
  return <Bank size={15} />
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

  return (
    <>
      <section className="card-s5 mt-6 p-4">
        <p className="text-xs font-semibold text-text-secondary">Pendientes</p>
        <p className="mt-1 text-2xl font-extrabold text-text-primary">{pendingCount}</p>
        <p className="mt-1 text-xs text-text-tertiary">
          {buckets.eligible.length} listas para revisar · {buckets.cardPending.length} pagadas con tarjeta · {buckets.unknown.length} {buckets.unknown.length === 1 ? 'pendiente' : 'pendientes'} de clasificar
        </p>
      </section>

      <section className="mt-7" aria-labelledby="eligible-title">
        <h2 id="eligible-title" className="text-lg font-bold">Listas para revisar</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Débitos observados de tu saldo de Mercado Pago.
        </p>
        <div className="mt-3 space-y-3">
          {buckets.eligible.map((movement) => (
            <div key={movement.candidateId} className="card-s5 flex min-h-20 items-start gap-3 p-4">
              <button type="button" onClick={() => onOpen(movement)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"><Wallet size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block font-bold">{getDisplayExpenseDescription(movement) || 'Movimiento de Mercado Pago'}</span><span className="mt-1 block text-xs text-text-secondary">{formatMoney(movement)} · {formatObservedDate(movement.balanceOccurredAt)} · {getMercadoPagoFundingSourceLabel(movement)}</span></span>
              </button>
              <button type="button" onClick={(event) => onDismiss(movement, event.currentTarget)} className="min-h-11 shrink-0 rounded-button border border-danger/30 px-3 text-xs font-semibold text-danger">Desestimar</button>
            </div>
          ))}
          {buckets.eligible.length === 0 && <p className="rounded-card bg-bg-secondary p-4 text-sm text-text-secondary">No hay débitos de saldo pendientes.</p>}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="card-title">
        <h2 id="card-title" className="text-lg font-bold">Pagadas con tarjeta</h2>
        <p className="mt-1 text-sm text-text-secondary">Se muestran para que no pierdas contexto. Todavía no se pueden confirmar: falta elegir tarjeta y ciclo.</p>
        <div className="mt-3 space-y-3">
          {buckets.cardPending.map((movement) => (
            <article key={movement.candidateId} className="card-s5 p-4">
              <div className="flex justify-between gap-3"><h3 className="font-bold">{getDisplayExpenseDescription(movement) || 'Compra con tarjeta'}</h3><span className="whitespace-nowrap font-semibold">{formatMoney(movement)}</span></div>
              <p className="mt-2 text-xs text-text-secondary">{formatObservedDate(movement.occurredAt)} · Pagado con tarjeta / falta elegir tarjeta y ciclo</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onOpen(movement)} className="min-h-11 rounded-button bg-primary px-3 text-xs font-semibold text-white">Revisar</button>
                <button type="button" onClick={(event) => onDismiss(movement, event.currentTarget)} className="min-h-11 rounded-button border border-danger/30 px-3 text-xs font-semibold text-danger">Desestimar</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {buckets.unknown.length > 0 && (
        <section className="mt-8">
          <h2 className="text-base font-bold">Otras operaciones</h2>
          <div className="mt-3 space-y-3">
            {buckets.unknown.map((movement) => (
              <article key={movement.candidateId} className="card-s5 p-4">
                <p className="font-semibold">{getDisplayExpenseDescription(movement) || 'Operación de Mercado Pago'}</p>
                <p className="mt-1 text-xs text-text-secondary">{formatMoney(movement)} · {formatObservedDate(movement.occurredAt)}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => onOpen(movement)} className="min-h-11 rounded-button bg-primary px-3 text-xs font-semibold text-white">Revisar</button>
                  <button type="button" onClick={(event) => onDismiss(movement, event.currentTarget)} className="min-h-11 rounded-button border border-danger/30 px-3 text-xs font-semibold text-danger">Desestimar</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {pendingCount === 0 && <p className="mt-10 text-center text-sm text-text-secondary">No hay operaciones pendientes para revisar.</p>}
    </>
  )
}

export function MercadoPagoReviewClient() {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MercadoPagoMovement | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [isWant, setIsWant] = useState<boolean | null>(null)
  const [accountId, setAccountId] = useState('')
  const [submitError, setSubmitError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [dismissed, setDismissed] = useState<MercadoPagoMovement | null>(null)
  const [dismissing, setDismissing] = useState(false)
  const [dismissError, setDismissError] = useState(false)
  const descriptionRef = useRef<HTMLInputElement>(null)
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
    setAccountsLoading(false)
    setAccountsError(false)
    setDescription('')
    setCategory('')
    setIsWant(null)
    setAccountId('')
    setSubmitError(false)
  }, [])

  const loadAccounts = useCallback(async () => {
    const request = ++accountsRequest.current
    setAccountsLoading(true)
    setAccountsError(false)
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
      if (request === accountsRequest.current) setAccountsError(true)
    } finally {
      if (request === accountsRequest.current) setAccountsLoading(false)
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
    setDescription(getInitialExpenseDescription(movement))
    setCategory('')
    setIsWant(null)
    setAccountId('')
    setSubmitError(false)
    if (isReviewableMercadoPagoExpense(movement)) void loadAccounts()
  }

  const confirm = async (event: FormEvent) => {
    event.preventDefault()
    if (
      !selected ||
      !isReviewableMercadoPagoExpense(selected) ||
      !description.trim() ||
      !category ||
      isWant === null ||
      !accountId ||
      accountsLoading ||
      accountsError
    ) {
      return
    }

    setSubmitting(true)
    setSubmitError(false)
    try {
      const response = await fetch(
        `/api/integrations/mercadopago/movements/${encodeURIComponent(selected.candidateId)}/confirm-expense`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            buildConfirmExpensePayload({ description, category, isWant, accountId }),
          ),
        },
      )
      if (!response.ok) throw new Error('confirmation failed')
      resetReview()
      await load()
    } catch {
      setSubmitError(true)
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
        initialFocusRef={descriptionRef}
        footer={(
          <button
            type="submit"
            form="mp-review-form"
            disabled={
              submitting ||
              accountsLoading ||
              accountsError ||
              !description.trim() ||
              !category ||
              isWant === null ||
              !accountId ||
              accounts.length === 0
            }
            className="min-h-11 w-full rounded-button bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? 'Registrando…' : 'Confirmar gasto'}
          </button>
        )}
      >
        <form id="mp-review-form" onSubmit={confirm} className="space-y-5">
          <section className="rounded-input border border-border-subtle bg-primary/[0.03] p-4">
            <p className="type-micro text-text-secondary">EVIDENCIA OBSERVADA</p>
            <p className="mt-3 text-sm font-semibold">
              {selected ? getDisplayExpenseDescription(selected) || 'Movimiento de Mercado Pago' : ''}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {selected
                ? `${formatMoney(selected)} · ${formatObservedDate(selected.balanceOccurredAt)} · Saldo de Mercado Pago`
                : ''}
            </p>
          </section>

          <label className="block text-sm font-semibold">
            Descripción
            <input
              ref={descriptionRef}
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-2 w-full rounded-input border border-border-subtle bg-white px-4 py-3 text-sm"
            />
          </label>

          <label className="block text-sm font-semibold">
            Categoría
            <select
              required
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-input border border-border-subtle bg-white px-4 text-sm"
            >
              <option value="">Elegí una categoría</option>
              {CATEGORIES.filter((item) => item !== 'Pago de Tarjetas').map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-semibold">Necesidad o deseo</legend>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => setIsWant(false)} aria-pressed={isWant === false} className="min-h-11 rounded-button border px-4 text-sm">Necesidad</button>
              <button type="button" onClick={() => setIsWant(true)} aria-pressed={isWant === true} className="min-h-11 rounded-button border px-4 text-sm">Deseo</button>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-semibold">Cuenta</legend>
            <p className="mt-1 text-xs text-text-secondary">
              Elegí la cuenta de Gota que representa tu saldo de Mercado Pago.
            </p>
            {accountsLoading && <p role="status" className="mt-2 text-sm text-text-secondary">Cargando cuentas…</p>}
            {accountsError && (
              <div role="alert" className="mt-2 rounded-input bg-danger-soft p-3 text-sm text-danger">
                <p>No pudimos cargar las cuentas. No confirmamos el gasto sin que elijas su origen.</p>
                <button
                  type="button"
                  onClick={() => selected && void loadAccounts()}
                  className="mt-2 min-h-11 font-semibold underline"
                >
                  Reintentar cuentas
                </button>
              </div>
            )}
            {!accountsLoading && !accountsError && accounts.length === 0 && (
              <p className="mt-2 text-sm text-text-secondary">No hay cuentas activas disponibles.</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setAccountId(account.id)}
                  aria-pressed={accountId === account.id}
                  className="inline-flex min-h-11 items-center gap-2 rounded-button border px-3 text-sm"
                >
                  <AccountIcon type={account.type} />
                  {account.name}
                </button>
              ))}
            </div>
          </fieldset>

          {submitError && (
            <p role="alert" className="text-sm text-danger">
              No pudimos registrar el gasto. Revisá los datos e intentá de nuevo.
            </p>
          )}
        </form>
      </TaskSurface>
    </main>
  )
}
