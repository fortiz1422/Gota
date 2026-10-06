'use client'

import Link from 'next/link'
import { MercadoPagoSetupCard, type MercadoPagoSetupState } from './MercadoPagoSetupCard'
import { useCallback, useEffect, useState } from 'react'
import { ArrowsClockwise, ArrowSquareOut, CaretRight } from '@phosphor-icons/react'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { getMercadoPagoValidationMessage } from '@/lib/mercadopago/sync-presentation'

type Source = { status: 'success' | 'error' | 'pending' | 'not_run'; count: number; observedInRun?: number; lastCompleteDate?: string | null }
type State = { state: 'not_connected' | 'connected' | 'error'; lastSyncAt: string | null; sources: { payments: Source; reports: Source }; sinceLastFullSync?: { available: boolean; beginDate: string | null } }

type AccountLink = { linkedAccountId: string | null; linkedAccountVersion: number; accounts: Array<{ id: string; name: string }> }

function sourceLabel(source: Source) {
  if (source.status === 'not_run') return 'Sin consultar'
  if (source.status === 'error') return 'No disponible'
  if (source.status === 'pending') return 'Preparando movimientos…'
  return `Disponible · ${source.count}`
}

export function MercadoPagoSettingsCard() {
  const [setup, setSetup] = useState<MercadoPagoSetupState | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    fetch('/api/integrations/mercadopago/setup', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error()
      const state = await response.json() as MercadoPagoSetupState
      if (active) setSetup(state)
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [])
  if (setup?.available) return <MercadoPagoSetupCard initialState={setup} />
  if (setup || failed) return <MercadoPagoReadOnlySettingsCard />
  return <p className="mt-6 text-[13px] text-text-secondary" role="status">Cargando Mercado Pago…</p>
}

// Existing connections retain their tools under Advanced while v2 rollout is
// disabled. Never claim background capture is active merely because OAuth works.
export function MercadoPagoConnectionView({ state, onManage }: { state: State | null; onManage: () => void }) {
  const connected = state?.state === 'connected'
  const disconnected = state?.state === 'not_connected'
  return <section className="mt-4 rounded-card border border-border-subtle bg-bg-primary p-4" aria-label="Mercado Pago">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-text-primary">Mercado Pago</h3>
      <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">{connected && <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />}{connected ? 'Conectado' : disconnected ? 'Sin conectar' : state?.state === 'error' ? 'Revisar conexión' : 'Verificando…'}</span>
    </div>
    <p className="mt-2 text-sm text-text-secondary">{disconnected ? 'Conectá tu cuenta para traer tus movimientos.' : 'Los movimientos se registran cuando los confirmás.'}</p>
    {state?.lastSyncAt && <p className="mt-2 text-xs text-text-tertiary">Última consulta · {new Date(state.lastSyncAt).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</p>}
    <div className="mt-3 flex items-center justify-between gap-3">
      {disconnected ? <Link href="/api/integrations/mercadopago/connect" className="inline-flex min-h-11 items-center rounded-button bg-primary px-4 text-sm font-semibold text-white">Conectar</Link> : <Link href="/mercadopago/review" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Ver movimientos <CaretRight size={14} aria-hidden="true" /></Link>}
      {!disconnected && <button type="button" onClick={onManage} className="min-h-11 px-2 text-xs font-medium text-text-secondary">Gestionar conexión</button>}
    </div>
    {disconnected && <p className="mt-2 text-xs text-text-tertiary">Gota no recibe tu contraseña de Mercado Pago.</p>}
  </section>
}

export function MercadoPagoReadOnlySettingsCard() {
  const [state, setState] = useState<State | null>(null)
  const [manage, setManage] = useState(false)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    void fetch('/api/integrations/mercadopago/sync', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error()
      const result = await response.json() as State
      if (active) setState(result)
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [])
  return <>
    <MercadoPagoConnectionView state={state} onManage={() => setManage(true)} />
    {error && <p role="alert" className="mt-2 text-xs text-danger">No pudimos consultar la conexión. Abrí Gestionar conexión para reintentar.</p>}
    <TaskSurface open={manage} onClose={() => setManage(false)} eyebrow="MERCADO PAGO" title="Gestionar conexión" description="Cuenta vinculada y consultas manuales." footer={null} showIntro={false} appearance="compact" canvasTone="standard">
      {manage && <LegacyMercadoPagoSettingsCard />}
    </TaskSurface>
  </>
}

function LegacyMercadoPagoSettingsCard() {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [preset, setPreset] = useState('7d')
  const [beginDate, setBeginDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [accountLink, setAccountLink] = useState<AccountLink | null>(null)
  const [linkedAccountId, setLinkedAccountId] = useState('')
  const [linkLoading, setLinkLoading] = useState(true)
  const [linkError, setLinkError] = useState(false)

  const load = async () => {
    setError(false)
    try {
      const response = await fetch('/api/integrations/mercadopago/sync', { cache: 'no-store' })
      if (!response.ok) throw new Error()
      setState(await response.json() as State)
    } catch {
      setError(true)
    }
  }

  const loadLink = useCallback(async () => {
    setLinkLoading(true)
    setLinkError(false)
    try {
      const response = await fetch('/api/integrations/mercadopago/account-link', { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const link = await response.json() as AccountLink
      setAccountLink(link)
      setLinkedAccountId(link.linkedAccountId ?? '')
    } catch {
      setAccountLink(null)
      setLinkedAccountId('')
      setLinkError(true)
    } finally {
      setLinkLoading(false)
    }
  }, [])

  useEffect(() => { void load(); void loadLink() }, [loadLink])

  const saveLink = async () => {
    if (!linkedAccountId) return
    setBusy(true)
    setLinkError(false)
    try {
      const response = await fetch('/api/integrations/mercadopago/account-link', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: linkedAccountId }),
      })
      if (!response.ok) throw new Error()
      await loadLink()
      setMessage('La cuenta elegida se usará sólo para confirmaciones nuevas.')
    } catch {
      setLinkError(true)
      setMessage('No pudimos guardar la cuenta elegida.')
    } finally {
      setBusy(false)
    }
  }

  const sync = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const payload = preset === 'custom' ? { preset, beginDate, endDate } : { preset }
      const response = await fetch('/api/integrations/mercadopago/sync', {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const result = await response.json() as Pick<State, 'sources'> & { range?: { beginDate: string; endDate: string } }
      if (!response.ok) throw new Error()
      setMessage(getMercadoPagoValidationMessage(result.sources))
      await load()
    } catch {
      setMessage('No se pudo validar ese rango.')
    } finally {
      setBusy(false)
    }
  }

  return <MercadoPagoManagementView state={state} busy={busy} message={message} error={error} preset={preset} setPreset={setPreset} beginDate={beginDate} setBeginDate={setBeginDate} endDate={endDate} setEndDate={setEndDate} accountLink={accountLink} linkedAccountId={linkedAccountId} setLinkedAccountId={setLinkedAccountId} linkLoading={linkLoading} linkError={linkError} onLoad={() => void load()} onLoadLink={() => void loadLink()} onSaveLink={() => void saveLink()} onSync={() => void sync()} />
}

export function MercadoPagoManagementView({ state, busy, message, error, preset, setPreset, beginDate, setBeginDate, endDate, setEndDate, accountLink, linkedAccountId, setLinkedAccountId, linkLoading, linkError, onLoad, onLoadLink, onSaveLink, onSync }: {
  state: State | null; busy: boolean; message: string | null; error: boolean;
  preset: string; setPreset: (value: string) => void;
  beginDate: string; setBeginDate: (value: string) => void;
  endDate: string; setEndDate: (value: string) => void;
  accountLink: AccountLink | null; linkedAccountId: string; setLinkedAccountId: (value: string) => void;
  linkLoading: boolean; linkError: boolean;
  onLoad: () => void; onLoadLink: () => void; onSaveLink: () => void; onSync: () => void;
}) {
  const [editingAccount, setEditingAccount] = useState(false)
  const currentAccount = accountLink?.accounts.find(account => account.id === accountLink.linkedAccountId)?.name
  const current = state?.state
  const rangeLabel = preset === '7d' ? 'Últimos 7 días' : preset === '30d' ? 'Últimos 30 días' : preset === '60d' ? 'Últimos 60 días' : preset === 'custom' ? 'Período personalizado' : 'Desde la última consulta completa'
  return <section aria-label="Herramientas de conexión" className="space-y-5 pt-5 text-sm">
    {!state && !error && <p role="status" className="text-text-secondary">Cargando conexión…</p>}
    {error && <p role="alert" className="text-danger">No pudimos cargar la conexión. <button onClick={onLoad} className="min-h-11 font-semibold text-primary">Reintentar</button></p>}
    {current === 'connected' && <section className="rounded-card border border-border-subtle p-4" aria-labelledby="mercadopago-account-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><h3 id="mercadopago-account-title" className="text-xs text-text-secondary">Cuenta vinculada</h3><p className="mt-1 truncate font-semibold text-text-primary">{linkLoading ? 'Cargando…' : currentAccount ?? 'Sin cuenta vinculada'}</p></div>
        {!editingAccount && !linkLoading && !linkError && <button type="button" onClick={() => setEditingAccount(true)} className="min-h-11 shrink-0 px-2 font-medium text-primary">{currentAccount ? 'Cambiar' : 'Elegir'}</button>}
      </div>
      {linkError && <p role="alert" className="mt-2 text-danger">No pudimos cargar la cuenta. <button onClick={onLoadLink} className="min-h-11 font-semibold">Reintentar</button></p>}
      {editingAccount && <div className="mt-3 space-y-3">
        <label htmlFor="mercadopago-linked-account" className="block text-xs text-text-secondary">Usar para próximos gastos con saldo MP</label>
        <select id="mercadopago-linked-account" value={linkedAccountId} onChange={event => setLinkedAccountId(event.target.value)} disabled={busy} className="min-h-11 w-full rounded-input border border-border-subtle bg-bg-secondary px-3 text-sm"><option value="">Elegí una cuenta digital</option>{accountLink?.accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
        {accountLink?.accounts.length === 0 && <p className="text-xs text-text-secondary">No tenés cuentas digitales activas.</p>}
        <div className="flex gap-3"><button type="button" onClick={onSaveLink} disabled={busy || !linkedAccountId || linkedAccountId === accountLink?.linkedAccountId} className="min-h-11 rounded-button bg-primary px-4 font-semibold text-white disabled:opacity-50">Guardar</button><button type="button" disabled={busy} onClick={() => { setLinkedAccountId(accountLink?.linkedAccountId ?? ''); setEditingAccount(false) }} className="min-h-11 px-3 text-text-secondary">Cerrar</button></div>
        <Link href="/web/settings?section=cuentas" className="inline-flex min-h-11 items-center text-xs text-primary">Gestionar cuentas</Link>
      </div>}
    </section>}
    {state && current !== 'not_connected' && <section className="space-y-3" aria-label="Actualizar movimientos">
      <button type="button" onClick={onSync} disabled={busy} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-button bg-primary px-4 font-semibold text-white disabled:opacity-50"><ArrowsClockwise size={18} aria-hidden="true" />{busy ? 'Actualizando…' : 'Actualizar movimientos'}</button>
      <p className="text-center text-xs text-text-tertiary">{rangeLabel}{state.lastSyncAt ? ` · Última consulta ${new Date(state.lastSyncAt).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}` : ''}</p>
      <details className="border-b border-border-subtle pb-3">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between text-text-secondary">Consultar otro período <CaretRight size={14} aria-hidden="true" /></summary>
        <label htmlFor="mercadopago-sync-range" className="sr-only">Período de consulta</label>
        <select id="mercadopago-sync-range" value={preset} disabled={busy} onChange={event => setPreset(event.target.value)} className="mt-2 min-h-11 w-full rounded-input border border-border-subtle bg-bg-secondary px-3"><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option><option value="60d">Últimos 60 días</option>{state.sinceLastFullSync?.available && <option value="since_last_full_sync">Desde última consulta completa</option>}<option value="custom">Personalizado</option></select>
        {preset === 'custom' && <div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs">Desde<input type="date" disabled={busy} value={beginDate} onChange={event => setBeginDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-input border border-border-subtle px-2" /></label><label className="text-xs">Hasta<input type="date" disabled={busy} value={endDate} onChange={event => setEndDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-input border border-border-subtle px-2" /></label></div>}
      </details>
      <Link href="/mercadopago/review" className="flex min-h-11 items-center justify-between font-medium text-primary">Ver movimientos <CaretRight size={16} aria-hidden="true" /></Link>
    </section>}
    {message && <p role="status" className="rounded-input bg-bg-secondary p-3 text-xs text-text-secondary">{message}</p>}
    <details className="border-t border-border-subtle pt-3">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between text-xs text-text-tertiary">Diagnóstico de conexión <CaretRight size={14} aria-hidden="true" /></summary>
      <dl className="mt-2 space-y-2 rounded-input bg-bg-secondary p-3 text-xs text-text-secondary"><div className="flex justify-between gap-3"><dt>Movimientos</dt><dd>{state ? sourceLabel(state.sources.payments) : '—'}</dd></div><div className="flex justify-between gap-3"><dt>Reporte de saldo</dt><dd>{state ? sourceLabel(state.sources.reports) : '—'}</dd></div></dl>
    </details>
    {current === 'not_connected' && <Link href="/api/integrations/mercadopago/connect" className="inline-flex min-h-11 items-center gap-2 rounded-button bg-primary px-4 font-semibold text-white"><ArrowSquareOut size={14} />Conectar Mercado Pago</Link>}
  </section>
}
