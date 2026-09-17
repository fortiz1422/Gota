'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowsClockwise,
  ArrowSquareOut,
  Bank,
  DeviceMobileSpeaker,
  Wallet,
} from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { getMercadoPagoValidationMessage } from '@/lib/mercadopago/sync-presentation'
import { CATEGORIES } from '@/lib/validation/schemas'
import {
  buildConfirmExpensePayload,
  getDisplayExpenseDescription,
  getInitialExpenseDescription,
  getMercadoPagoDisplayAmount,
  isReviewableMercadoPagoExpense,
  type MercadoPagoDiagnostic,
} from './mercadopago-expense-review'

type Source = {
  status: 'success' | 'error' | 'pending' | 'not_run'
  count: number
}
type State = {
  state: 'not_connected' | 'connected' | 'error'
  lastSyncAt: string | null
  sources: { payments: Source; reports: Source }
}
type Diagnostic = MercadoPagoDiagnostic & {
  kind: string
  direction: string
  fundingSource: { kind: string; brand?: string; lastFour?: string }
  channel: string
  installments: number | null
  confidence: string
  sources: string[]
  match: 'exact_native_id' | 'single_source'
  operation: { status: string | null; statusDetail: string | null }
}
type DiagnosticState = {
  aggregates: Record<string, number>
  movements: Diagnostic[]
}
type Account = {
  id: string
  name: string
  type: 'cash' | 'bank' | 'digital'
  archived: boolean
}

function sourceLabel(source: Source) {
  if (source.status === 'not_run') return 'Todavía sin validación'
  if (source.status === 'error') return 'No disponible'
  if (source.status === 'pending') return 'Preparando movimientos…'
  return `Validada · ${source.count}`
}

function formatAmount(amount: Diagnostic['amount']) {
  if (amount.value === null) return '—'
  try {
    return amount.currency && /^[A-Z]{3}$/.test(amount.currency)
      ? new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: amount.currency,
        }).format(Math.abs(amount.value))
      : new Intl.NumberFormat('es-AR').format(Math.abs(amount.value))
  } catch {
    return new Intl.NumberFormat('es-AR').format(Math.abs(amount.value))
  }
}

const diagnosticLabel = (value: string | null | undefined) =>
  ({
    expense: 'Gasto',
    income: 'Ingreso',
    transfer: 'Transferencia',
    neutral: 'Técnica',
    unknown: 'Desconocida',
    outflow: 'Salida',
    inflow: 'Entrada',
    internal: 'Interna',
    mercadopago_balance: 'Saldo MP',
    card: 'Tarjeta',
    bank_transfer: 'Cuenta externa',
    CHECKOUT: 'Checkout',
    INSTORE: 'Presencial',
    SUBSCRIPTIONS: 'Suscripciones',
    PSP_TRANSFER: 'Transferencia PSP',
    UNSPECIFIED: 'Sin canal',
  })[value ?? ''] ??
  value ??
  'Sin dato'

function diagnosticFunding(funding: Diagnostic['fundingSource']) {
  const card = [
    funding.brand,
    funding.lastFour ? `•••• ${funding.lastFour}` : null,
  ]
    .filter(Boolean)
    .join(' ')
  return card
    ? `${diagnosticLabel(funding.kind)} · ${card}`
    : diagnosticLabel(funding.kind)
}

function AccountIcon({ type }: { type: Account['type'] }) {
  if (type === 'cash') return <Wallet weight="duotone" size={13} />
  if (type === 'digital')
    return <DeviceMobileSpeaker weight="duotone" size={13} />
  return <Bank weight="duotone" size={13} />
}

export function MercadoPagoSettingsCard() {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [diagnostics, setDiagnostics] = useState<DiagnosticState | null>(null)
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountsBusy, setAccountsBusy] = useState(false)
  const [accountsError, setAccountsError] = useState(false)
  const [selected, setSelected] = useState<Diagnostic | null>(null)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [isWant, setIsWant] = useState<boolean | null>(null)
  const [accountId, setAccountId] = useState('')
  const [submitBusy, setSubmitBusy] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  const load = async () => {
    setLoadError(false)
    try {
      const result = await fetch('/api/integrations/mercadopago/sync', {
        cache: 'no-store',
      })
      if (!result.ok) throw new Error('settings_load_failed')
      setState((await result.json()) as State)
    } catch {
      setLoadError(true)
    }
  }
  useEffect(() => {
    void load()
  }, [])

  const loadDiagnostics = async () => {
    setDiagnosticsBusy(true)
    setDiagnosticsError(false)
    try {
      const result = await fetch('/api/integrations/mercadopago/movements', {
        cache: 'no-store',
      })
      if (!result.ok) throw new Error('diagnostics_failed')
      setDiagnostics((await result.json()) as DiagnosticState)
    } catch {
      setDiagnosticsError(true)
    } finally {
      setDiagnosticsBusy(false)
    }
  }

  const sync = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await fetch('/api/integrations/mercadopago/sync', {
        method: 'POST',
        cache: 'no-store',
      })
      if (!result.ok) throw new Error('sync_failed')
      setMessage(
        getMercadoPagoValidationMessage(
          ((await result.json()) as Pick<State, 'sources'>).sources
        )
      )
      await load()
      if (diagnostics) await loadDiagnostics()
    } catch {
      setMessage('No se pudo completar la validación.')
    } finally {
      setBusy(false)
    }
  }

  const openReview = async (movement: Diagnostic) => {
    setSelected(movement)
    setDescription(getInitialExpenseDescription(movement))
    setCategory('')
    setIsWant(null)
    setAccountId('')
    setSubmitError(false)
    setAccountsBusy(true)
    setAccountsError(false)
    try {
      const result = await fetch('/api/accounts?include_archived=false', {
        cache: 'no-store',
      })
      if (!result.ok) throw new Error('accounts_failed')
      const rows = (await result.json()) as Array<Partial<Account>>
      setAccounts(
        rows
          .filter(
            (row): row is Account =>
              typeof row.id === 'string' &&
              typeof row.name === 'string' &&
              (row.type === 'cash' ||
                row.type === 'bank' ||
                row.type === 'digital') &&
              row.archived !== true
          )
          .map(({ id, name, type, archived }) => ({
            id,
            name,
            type,
            archived: Boolean(archived),
          }))
      )
    } catch {
      setAccountsError(true)
    } finally {
      setAccountsBusy(false)
    }
  }

  const closeReview = () => {
    if (!submitBusy) setSelected(null)
  }
  const confirmExpense = async (event: React.FormEvent) => {
    event.preventDefault()
    if (
      !selected ||
      submitBusy ||
      !description.trim() ||
      !category ||
      isWant === null ||
      !accountId
    )
      return
    setSubmitBusy(true)
    setSubmitError(false)
    try {
      const payload = buildConfirmExpensePayload({
        description,
        category,
        isWant,
        accountId,
      })
      const result = await fetch(
        `/api/integrations/mercadopago/movements/${encodeURIComponent(selected.candidateId)}/confirm-expense`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      if (!result.ok) throw new Error('confirm_failed')
      setDiagnostics((current) =>
        current
          ? {
              ...current,
              movements: current.movements.map((movement) =>
                movement.candidateId === selected.candidateId
                  ? { ...movement, reviewStatus: 'confirmed' }
                  : movement
              ),
            }
          : current
      )
      setSelected(null)
      await loadDiagnostics()
    } catch {
      setSubmitError(true)
    } finally {
      setSubmitBusy(false)
    }
  }

  const current = state?.state ?? 'not_connected'
  const chipClass = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'border-primary bg-primary/15 text-primary' : 'border-border-ocean bg-primary/[0.03] text-text-tertiary'}`

  return (
    <section className="mt-8" aria-labelledby="mercadopago-title">
      <div className="card-s5 p-4">
        <div className="flex items-start gap-3">
          <Wallet size={22} className="text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="mercadopago-title" className="text-[14px] font-bold">
                  Mercado Pago
                </h3>
                <p className="text-text-tertiary mt-1 text-[12px]">
                  Validación privada de solo lectura. Nada se importa al
                  registro financiero.
                </p>
              </div>
              <span className="bg-bg-secondary rounded-[20px] px-2.5 py-1 text-[11px] font-semibold">
                {current === 'connected'
                  ? 'Conectado'
                  : current === 'error'
                    ? 'Con error'
                    : 'No conectado'}
              </span>
            </div>
            {state === null && !loadError && (
              <p className="text-text-secondary mt-3 text-[12px]">
                Cargando estado de conexión…
              </p>
            )}
            {loadError && (
              <p className="text-error mt-3 text-[12px]">
                No pudimos cargar el estado. Podés reintentar más tarde.
              </p>
            )}
            {state?.lastSyncAt && (
              <p className="text-text-secondary mt-3 text-[12px]">
                Última validación:{' '}
                {new Date(state.lastSyncAt).toLocaleString('es-AR')}
              </p>
            )}
            <div className="border-border-ocean mt-3 overflow-hidden rounded-lg border">
              <div className="border-border-ocean grid grid-cols-2 border-b px-3 py-2 text-[11px] font-semibold">
                <span>Fuente</span>
                <span>Estado · cantidad</span>
              </div>
              <div className="grid grid-cols-2 px-3 py-2 text-[12px]">
                <span>Movimientos informados</span>
                <span>{state ? sourceLabel(state.sources.payments) : '—'}</span>
              </div>
              <div className="border-border-ocean grid grid-cols-2 border-t px-3 py-2 text-[12px]">
                <span>Saldo disponible</span>
                <span>{state ? sourceLabel(state.sources.reports) : '—'}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              {current !== 'not_connected' ? (
                <button
                  type="button"
                  onClick={() => void sync()}
                  disabled={busy}
                  className="rounded-button bg-primary inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  <ArrowsClockwise size={14} />
                  {busy ? 'Validando…' : 'Sincronizar ahora'}
                </button>
              ) : (
                <Link
                  href="/api/integrations/mercadopago/connect"
                  className="rounded-button bg-primary inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold text-white"
                >
                  <ArrowSquareOut size={14} />
                  Conectar Mercado Pago
                </Link>
              )}
            </div>
            {current === 'connected' && (
              <button
                type="button"
                onClick={() => void loadDiagnostics()}
                disabled={diagnosticsBusy}
                className="text-primary mt-3 text-[12px] font-semibold underline-offset-2 hover:underline disabled:opacity-50"
              >
                {diagnosticsBusy
                  ? 'Cargando operaciones…'
                  : diagnosticsError
                    ? 'Reintentar operaciones detectadas'
                    : 'Revisar operaciones'}
              </button>
            )}
            {diagnosticsError && (
              <p className="text-error mt-2 text-[12px]" role="status">
                No pudimos cargar las operaciones detectadas. Podés reintentar.
              </p>
            )}
            {diagnostics && (
              <div className="mt-3" aria-label="Diagnóstico de operaciones">
                <p className="text-text-secondary text-[11px]">
                  Todas las operaciones informadas por Mercado Pago están
                  listadas. Por ahora sólo podés confirmar salidas comprobadas
                  de tu saldo disponible.
                </p>
                <div className="mt-2 space-y-2">
                  {diagnostics.movements.map((movement) => (
                    <div
                      key={movement.candidateId}
                      className="border-border-ocean rounded-lg border p-3 text-[11px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold">
                          {movement.reviewStatus === 'confirmed'
                            ? 'Gasto registrado'
                            : getDisplayExpenseDescription(movement) ||
                              'Movimiento de Mercado Pago'}
                        </span>
                        <span className="whitespace-nowrap">
                          {formatAmount(getMercadoPagoDisplayAmount(movement))}
                        </span>
                      </div>
                      {movement.description &&
                        getDisplayExpenseDescription(movement) !==
                          movement.description && (
                          <div className="text-text-tertiary mt-1">
                            Descripción informada: {movement.description}
                          </div>
                        )}
                      <div className="text-text-secondary mt-1">
                        {movement.occurredAt
                          ? new Date(movement.occurredAt).toLocaleDateString(
                              'es-AR'
                            )
                          : 'Sin fecha'}{' '}
                        ·{' '}
                        {getMercadoPagoDisplayAmount(movement).currency ??
                          'Moneda no informada'}
                        {movement.balanceImpact.observed &&
                        movement.balanceImpact.effect === 'debit'
                          ? ' · Salió de Dinero disponible de Mercado Pago'
                          : ''}
                      </div>
                      <div className="text-text-tertiary mt-1">
                        {diagnosticLabel(movement.kind)} ·{' '}
                        {diagnosticLabel(movement.direction)} ·{' '}
                        {diagnosticFunding(movement.fundingSource)} ·{' '}
                        {diagnosticLabel(movement.channel)} ·{' '}
                        {movement.operation.status ?? 'Sin estado'}
                        {movement.operation.statusDetail
                          ? ` · ${movement.operation.statusDetail}`
                          : ''}
                        {movement.installments
                          ? ` · ${movement.installments} cuotas`
                          : ''}{' '}
                        ·{' '}
                        {movement.confidence === 'confirmed'
                          ? 'Interpretación alta'
                          : movement.confidence === 'partial'
                            ? 'Interpretación parcial'
                            : 'Interpretación sin resolver'}
                      </div>
                      {isReviewableMercadoPagoExpense(movement) && (
                        <button
                          type="button"
                          onClick={() => void openReview(movement)}
                          className="rounded-button bg-primary mt-3 px-3 py-2 text-[12px] font-semibold text-white"
                        >
                          Revisar como gasto
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {message && (
              <p className="text-text-secondary mt-3 text-[12px]" role="status">
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
      {selected && (
        <Modal open onClose={closeReview} title="Confirmar gasto">
          <form onSubmit={confirmExpense} className="space-y-5">
            <section
              aria-label="Evidencia observada de Mercado Pago"
              className="rounded-input border-border-subtle bg-primary/[0.03] border p-4"
            >
              <p className="type-micro text-text-secondary">
                EVIDENCIA OBSERVADA
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">Fecha</dt>
                  <dd className="text-right font-medium">
                    {selected.balanceOccurredAt
                      ? new Date(selected.balanceOccurredAt).toLocaleDateString(
                          'es-AR'
                        )
                      : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">Monto</dt>
                  <dd className="text-right font-medium">
                    {formatAmount(selected.balanceImpact.amount)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">Moneda</dt>
                  <dd className="text-right font-medium">
                    {selected.balanceImpact.amount.currency ??
                      'Moneda no informada'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">Saldo</dt>
                  <dd className="text-right font-medium">
                    Salida de Dinero disponible de Mercado Pago
                  </dd>
                </div>
              </dl>
            </section>
            <div>
              <label className="text-text-secondary mb-2 block text-[10px] font-medium tracking-wider uppercase">
                Descripción
              </label>
              <input
                required
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={100}
                placeholder="Ej. Panadería"
                className="rounded-input bg-bg-tertiary text-text-primary focus:border-primary placeholder:text-text-disabled w-full border border-transparent px-4 py-3 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-text-secondary mb-2 block text-[10px] font-medium tracking-wider uppercase">
                Categoría
              </label>
              <select
                required
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="rounded-input bg-bg-tertiary text-text-primary focus:border-primary w-full border border-transparent px-4 py-3 text-sm focus:outline-none"
              >
                <option value="">Elegí una categoría</option>
                {CATEGORIES.filter((item) => item !== 'Pago de Tarjetas').map(
                  (item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  )
                )}
              </select>
            </div>
            <fieldset>
              <legend className="text-text-secondary mb-2 text-[10px] font-medium tracking-wider uppercase">
                Necesidad o deseo
              </legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-pressed={isWant === false}
                  onClick={() => setIsWant(false)}
                  className={chipClass(isWant === false)}
                >
                  Necesidad
                </button>
                <button
                  type="button"
                  aria-pressed={isWant === true}
                  onClick={() => setIsWant(true)}
                  className={chipClass(isWant === true)}
                >
                  Deseo
                </button>
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-text-secondary mb-2 text-[10px] font-medium tracking-wider uppercase">
                De dónde sale
              </legend>
              <div
                className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label="Cuenta de Gota"
              >
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    aria-pressed={accountId === account.id}
                    onClick={() => setAccountId(account.id)}
                    className={chipClass(accountId === account.id)}
                  >
                    <AccountIcon type={account.type} />
                    <span>{account.name}</span>
                  </button>
                ))}
              </div>
              <p className="text-text-secondary mt-2 text-xs">
                Elegí la cuenta de Gota que representa tu saldo de Mercado Pago.
              </p>
              {accountsBusy && (
                <p className="text-text-secondary mt-2 text-xs">
                  Cargando cuentas…
                </p>
              )}
              {accountsError && (
                <p className="text-error mt-2 text-xs">
                  No pudimos cargar las cuentas.
                </p>
              )}
              {!accountsBusy && !accountsError && accounts.length === 0 && (
                <p className="text-text-secondary mt-2 text-xs">
                  No hay cuentas activas disponibles.
                </p>
              )}
            </fieldset>
            {submitError && (
              <p className="text-error text-sm" role="alert">
                No pudimos registrar el gasto. Revisá los datos e intentá de
                nuevo.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={
                  submitBusy ||
                  accountsBusy ||
                  accountsError ||
                  accounts.length === 0 ||
                  !description.trim() ||
                  !category ||
                  !accountId ||
                  isWant === null
                }
                className="rounded-button bg-primary text-bg-primary w-full py-3 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitBusy ? 'Registrando…' : 'Confirmar gasto'}
              </button>
              <button
                type="button"
                onClick={closeReview}
                disabled={submitBusy}
                className="rounded-button text-text-secondary hover:bg-surface hover:text-text-primary w-full py-3 text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
