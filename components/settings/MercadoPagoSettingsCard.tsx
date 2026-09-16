'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowsClockwise, ArrowSquareOut, Wallet, X } from '@phosphor-icons/react'
import { getMercadoPagoValidationMessage } from '@/lib/mercadopago/sync-presentation'
import { CATEGORIES } from '@/lib/validation/schemas'
import {
  buildConfirmExpensePayload,
  getInitialExpenseDescription,
  isReviewableMercadoPagoExpense,
  type MercadoPagoDiagnostic,
} from './mercadopago-expense-review'

type Source = { status: 'success' | 'error' | 'pending' | 'not_run'; count: number }
type State = { state: 'not_connected' | 'connected' | 'error'; lastSyncAt: string | null; sources: { payments: Source; reports: Source } }
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
type DiagnosticState = { aggregates: Record<string, number>; movements: Diagnostic[] }
type Account = { id: string; name: string; type: string; archived: boolean }

function sourceLabel(source: Source) {
  if (source.status === 'not_run') return 'Todavía sin validación'
  if (source.status === 'error') return 'No disponible'
  if (source.status === 'pending') return 'Preparando movimientos…'
  return `Validada · ${source.count}`
}

function formatAmount(amount: Diagnostic['balanceImpact']['amount']) {
  if (amount.value === null) return '—'
  try {
    return amount.currency && /^[A-Z]{3}$/.test(amount.currency)
      ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: amount.currency }).format(Math.abs(amount.value))
      : new Intl.NumberFormat('es-AR').format(Math.abs(amount.value))
  } catch { return new Intl.NumberFormat('es-AR').format(Math.abs(amount.value)) }
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
      const result = await fetch('/api/integrations/mercadopago/sync', { cache: 'no-store' })
      if (!result.ok) throw new Error('settings_load_failed')
      setState(await result.json() as State)
    } catch { setLoadError(true) }
  }
  useEffect(() => { void load() }, [])

  const sync = async () => {
    setBusy(true); setMessage(null)
    try {
      const result = await fetch('/api/integrations/mercadopago/sync', { method: 'POST', cache: 'no-store' })
      if (!result.ok) throw new Error('sync_failed')
      setMessage(getMercadoPagoValidationMessage((await result.json() as Pick<State, 'sources'>).sources))
      await load()
      if (diagnostics) await loadDiagnostics()
    } catch { setMessage('No se pudo completar la validación.') } finally { setBusy(false) }
  }

  const loadDiagnostics = async () => {
    setDiagnosticsBusy(true); setDiagnosticsError(false)
    try {
      const result = await fetch('/api/integrations/mercadopago/movements', { cache: 'no-store' })
      if (!result.ok) throw new Error('diagnostics_failed')
      setDiagnostics(await result.json() as DiagnosticState)
    } catch { setDiagnosticsError(true) } finally { setDiagnosticsBusy(false) }
  }

  const openReview = async (movement: Diagnostic) => {
    setSelected(movement); setDescription(getInitialExpenseDescription(movement)); setCategory(''); setIsWant(null); setAccountId(''); setSubmitError(false)
    setAccountsBusy(true); setAccountsError(false)
    try {
      const result = await fetch('/api/accounts?include_archived=false', { cache: 'no-store' })
      if (!result.ok) throw new Error('accounts_failed')
      const rows = await result.json() as Array<Partial<Account>>
      setAccounts(rows.filter((row): row is Account => typeof row.id === 'string' && typeof row.name === 'string' && typeof row.type === 'string' && row.archived !== true).map(({ id, name, type, archived }) => ({ id, name, type, archived: Boolean(archived) })))
    } catch { setAccountsError(true) } finally { setAccountsBusy(false) }
  }

  const closeReview = () => { if (!submitBusy) setSelected(null) }
  const confirmExpense = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected || submitBusy || !description.trim() || !category || isWant === null || !accountId) return
    setSubmitBusy(true); setSubmitError(false)
    try {
      const payload = buildConfirmExpensePayload({ description, category, isWant, accountId })
      const result = await fetch(`/api/integrations/mercadopago/movements/${encodeURIComponent(selected.candidateId)}/confirm-expense`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!result.ok) throw new Error('confirm_failed')
      setDiagnostics((current) => current ? { ...current, movements: current.movements.map((movement) => movement.candidateId === selected.candidateId ? { ...movement, reviewStatus: 'confirmed' } : movement) } : current)
      setSelected(null)
      await loadDiagnostics()
    } catch { setSubmitError(true) } finally { setSubmitBusy(false) }
  }

  const current = state?.state ?? 'not_connected'

  return <section className="mt-8" aria-labelledby="mercadopago-title">
    <div className="card-s5 p-4"><div className="flex items-start gap-3"><Wallet size={22} className="text-primary" /><div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3"><div><h3 id="mercadopago-title" className="text-[14px] font-bold">Mercado Pago</h3><p className="mt-1 text-[12px] text-text-tertiary">Validación privada de solo lectura. Nada se importa al registro financiero.</p></div><span className="rounded-[20px] bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold">{current === 'connected' ? 'Conectado' : current === 'error' ? 'Con error' : 'No conectado'}</span></div>
      {state === null && !loadError && <p className="mt-3 text-[12px] text-text-secondary">Cargando estado de conexión…</p>}{loadError && <p className="mt-3 text-[12px] text-error">No pudimos cargar el estado. Podés reintentar más tarde.</p>}{state?.lastSyncAt && <p className="mt-3 text-[12px] text-text-secondary">Última validación: {new Date(state.lastSyncAt).toLocaleString('es-AR')}</p>}
      <div className="mt-3 overflow-hidden rounded-lg border border-border-ocean"><div className="grid grid-cols-2 border-b border-border-ocean px-3 py-2 text-[11px] font-semibold"><span>Fuente</span><span>Estado · cantidad</span></div><div className="grid grid-cols-2 px-3 py-2 text-[12px]"><span>Movimientos informados</span><span>{state ? sourceLabel(state.sources.payments) : '—'}</span></div><div className="grid grid-cols-2 border-t border-border-ocean px-3 py-2 text-[12px]"><span>Saldo disponible</span><span>{state ? sourceLabel(state.sources.reports) : '—'}</span></div></div>
      <div className="mt-4 flex gap-2">{current !== 'not_connected' ? <button type="button" onClick={() => void sync()} disabled={busy} className="inline-flex items-center gap-2 rounded-button bg-primary px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"><ArrowsClockwise size={14} />{busy ? 'Validando…' : 'Sincronizar ahora'}</button> : <Link href="/api/integrations/mercadopago/connect" className="inline-flex items-center gap-2 rounded-button bg-primary px-4 py-2.5 text-[13px] font-semibold text-white"><ArrowSquareOut size={14} />Conectar Mercado Pago</Link>}</div>
      {current === 'connected' && <button type="button" onClick={() => void loadDiagnostics()} disabled={diagnosticsBusy} className="mt-3 text-[12px] font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50">{diagnosticsBusy ? 'Cargando operaciones…' : diagnosticsError ? 'Reintentar operaciones detectadas' : 'Revisar operaciones'}</button>}{diagnosticsError && <p className="mt-2 text-[12px] text-error" role="status">No pudimos cargar las operaciones detectadas. Podés reintentar.</p>}
      {diagnostics && <div className="mt-3" aria-label="Diagnóstico de operaciones"><p className="text-[11px] text-text-secondary">Revisá sólo los movimientos que salieron de tu saldo de Mercado Pago.</p><div className="mt-2 space-y-2">{diagnostics.movements.map((movement) => <div key={movement.candidateId} className="rounded-lg border border-border-ocean p-3 text-[11px]"><div className="flex items-start justify-between gap-2"><span className="font-semibold">{movement.reviewStatus === 'confirmed' ? 'Gasto registrado' : movement.description ?? 'Movimiento de Mercado Pago'}</span><span className="whitespace-nowrap">{formatAmount(movement.balanceImpact.amount)}</span></div><div className="mt-1 text-text-secondary">{movement.occurredAt ? new Date(movement.occurredAt).toLocaleDateString('es-AR') : 'Sin fecha'} · {movement.balanceImpact.amount.currency ?? 'Moneda no informada'} · Salió de Dinero disponible de Mercado Pago</div>{isReviewableMercadoPagoExpense(movement) && <button type="button" onClick={() => void openReview(movement)} className="mt-3 rounded-button bg-primary px-3 py-2 text-[12px] font-semibold text-white">Revisar como gasto</button>}</div>)}</div></div>}
      {message && <p className="mt-3 text-[12px] text-text-secondary" role="status">{message}</p>}
    </div></div></div>
    {selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-expense-title"><form onSubmit={confirmExpense} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h2 id="confirm-expense-title" className="text-lg font-bold">Confirmar gasto</h2><button type="button" onClick={closeReview} disabled={submitBusy} aria-label="Cerrar"><X size={20} /></button></div><div className="mt-4 space-y-2 rounded-lg bg-bg-secondary p-3 text-sm"><p><strong>Fecha:</strong> {selected.occurredAt ? new Date(selected.occurredAt).toLocaleDateString('es-AR') : '—'}</p><p><strong>Monto:</strong> {formatAmount(selected.balanceImpact.amount)}</p><p>Salió de Dinero disponible de Mercado Pago</p>{!selected.description && <p>Mercado Pago no informó el comercio.</p>}</div><label className="mt-4 block text-sm font-semibold">Descripción<input required value={description} onChange={(event) => setDescription(event.target.value)} maxLength={100} className="mt-1 w-full rounded-input border border-border-ocean px-3 py-2" /></label><label className="mt-3 block text-sm font-semibold">Categoría<select required value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-input border border-border-ocean px-3 py-2"><option value="">Elegí una categoría</option>{CATEGORIES.filter((item) => item !== 'Pago de Tarjetas').map((item) => <option key={item} value={item}>{item}</option>)}</select></label><fieldset className="mt-3"><legend className="text-sm font-semibold">¿Fue una necesidad o un deseo?</legend><div className="mt-1 flex gap-4"><label><input type="radio" name="isWant" checked={isWant === false} onChange={() => setIsWant(false)} required /> Necesidad</label><label><input type="radio" name="isWant" checked={isWant === true} onChange={() => setIsWant(true)} /> Deseo</label></div></fieldset><label className="mt-3 block text-sm font-semibold">Cuenta de Gota<select required value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={accountsBusy || accountsError || accounts.length === 0} className="mt-1 w-full rounded-input border border-border-ocean px-3 py-2"><option value="">{accountsBusy ? 'Cargando cuentas…' : accountsError ? 'No pudimos cargar las cuentas' : accounts.length === 0 ? 'No hay cuentas activas' : 'Elegí una cuenta'}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><p className="mt-2 text-xs text-text-secondary">Elegí la cuenta de Gota que representa tu saldo de Mercado Pago.</p>{submitError && <p className="mt-3 text-sm text-error" role="alert">No pudimos registrar el gasto. Revisá los datos e intentá de nuevo.</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={closeReview} disabled={submitBusy} className="rounded-button px-4 py-2 text-sm font-semibold">Cancelar</button><button type="submit" disabled={submitBusy || accountsBusy || accounts.length === 0} className="rounded-button bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitBusy ? 'Registrando…' : 'Confirmar gasto'}</button></div></form></div>}
  </section>
}
