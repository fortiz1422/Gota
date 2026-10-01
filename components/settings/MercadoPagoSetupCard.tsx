'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { InitialImportPreset } from '@/lib/mercadopago/initial-import'

export type MercadoPagoSetupState = {
  available: boolean
  state?: 'not_connected' | 'connected' | 'needs_reconnect'
  mode?: 'shadow'
  enabled?: boolean
  initialImport?: { status: 'not_started' | 'running' | 'completed' | 'error'; preset: InitialImportPreset | null; startedAt: string | null; completedAt: string | null }
  lastUpdateAt?: string | null
  lastAttemptAt?: string | null
  accountName?: string | null
}

export function MercadoPagoSetupView({ state, preset, setPreset, busy, error, onStart, onResume, onDisconnect }: {
  state: MercadoPagoSetupState; preset: InitialImportPreset; setPreset: (value: InitialImportPreset) => void; busy: boolean; error: string | null;
  onStart: () => void; onResume: () => void; onDisconnect: () => void
}) {
  const needsSetup = state.state === 'connected' && (!state.initialImport || state.initialImport.status === 'not_started')
  return (
    <section className="mt-6 rounded-card border border-border-subtle bg-bg-primary p-5" aria-labelledby="mp-v2-title">
      <div className="flex items-center justify-between gap-3">
        <h3 id="mp-v2-title" className="text-[15px] font-semibold text-text-primary">Mercado Pago</h3>
        <span className="rounded-full bg-bg-secondary px-3 py-1 text-[12px] text-text-secondary">{state.state === 'connected' ? 'Conectado' : state.state === 'needs_reconnect' ? 'Necesita reconexión' : 'No conectado'}</span>
      </div>
      <p className="mt-3 text-[13px] text-text-secondary">Gota no recibe ni almacena tu contraseña de Mercado Pago.</p>
      {state.state !== 'connected' ? (
        <Link href="/api/integrations/mercadopago/connect" className="mt-4 inline-flex min-h-11 items-center rounded-button bg-primary px-4 text-[13px] font-semibold text-white">{state.state === 'needs_reconnect' ? 'Reconectar Mercado Pago' : 'Conectar Mercado Pago'}</Link>
      ) : (
        <>
          <p className="mt-3 text-[13px] text-text-secondary">Estamos validando la captura automática. Los movimientos todavía requieren revisión antes de registrarse.</p>
          {needsSetup ? (
            <fieldset disabled={busy} className="mt-5">
              <legend className="text-[14px] font-semibold">¿Desde cuándo querés empezar?</legend>
              <div className="mt-2 flex flex-col gap-1">
                {([['today', 'Desde hoy'], ['30d', 'Últimos 30 días'], ['90d', 'Últimos 90 días']] as const).map(([value, label]) => (
                  <label key={value} className="flex min-h-11 cursor-pointer items-center gap-3 text-[13px]"><input type="radio" name="mp-import" value={value} checked={preset === value} onChange={() => setPreset(value)} />{label}</label>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-text-tertiary">Vincularemos tu cuenta Mercado Pago en Gota o crearemos una. Su saldo inicial queda pendiente de verificar.</p>
              <button type="button" onClick={onStart} className="mt-4 min-h-11 rounded-button bg-primary px-4 text-[13px] font-semibold text-white disabled:opacity-50">{busy ? 'Preparando…' : 'Continuar'}</button>
            </fieldset>
          ) : (
            <>
              <dl className="mt-4 space-y-3 text-[13px]">
                <div><dt className="text-text-tertiary">Cuenta en Gota</dt><dd className="mt-1 font-medium">{state.accountName ?? 'Necesita vincularse'}</dd></div>
                <div><dt className="text-text-tertiary">Movimientos desde</dt><dd className="mt-1">{state.initialImport?.startedAt ? new Date(state.initialImport.startedAt).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : 'Pendiente'}</dd></div>
                <div><dt className="text-text-tertiary">Última actualización</dt><dd className="mt-1">{state.lastUpdateAt ? new Date(state.lastUpdateAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : 'Esperando la primera actualización'}</dd></div>
              </dl>
              {state.initialImport?.status === 'running' && <p role="status" className="mt-4 text-[13px] text-text-secondary">Preparando tus movimientos. Podés cerrar Gota; la captura continúa en segundo plano cuando el servicio programado está activo.</p>}
              {!state.enabled && <button type="button" disabled={busy} onClick={onResume} className="mt-4 min-h-11 rounded-button bg-primary px-4 text-[13px] font-semibold text-white disabled:opacity-50">Reanudar captura</button>}
              <Link href="/mercadopago/review" className="mt-4 inline-flex min-h-11 items-center text-[13px] font-semibold text-primary underline">Revisar movimientos</Link>
            </>
          )}
          <details className="mt-5 border-t border-border-subtle pt-3">
            <summary className="cursor-pointer text-[13px] text-text-secondary">Opciones avanzadas</summary>
            <p className="mt-3 text-[12px] text-text-secondary">Al desconectar se detiene la captura y se eliminan las credenciales guardadas por Gota. Las cuentas y los movimientos ya registrados se conservan.</p>
            <button type="button" onClick={onDisconnect} disabled={busy} className="mt-2 min-h-11 text-[13px] font-semibold text-error disabled:opacity-50">Desconectar Mercado Pago</button>
          </details>
        </>
      )}
      {error && <p role="alert" className="mt-4 text-[13px] text-error">{error}</p>}
    </section>
  )
}

export function MercadoPagoSetupCard({ initialState }: { initialState?: MercadoPagoSetupState }) {
  const [state, setState] = useState<MercadoPagoSetupState | null>(initialState ?? null)
  const [preset, setPreset] = useState<InitialImportPreset>('30d')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountChoices, setAccountChoices] = useState<Array<{ id: string; name: string }>>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/integrations/mercadopago/setup', { cache: 'no-store' })
      if (!response.ok) throw new Error()
      setState(await response.json() as MercadoPagoSetupState)
      setError(null)
    } catch { setError('No pudimos cargar la conexión. Intentá de nuevo.') }
  }, [])
  useEffect(() => { void load(); const timer = setInterval(() => { void load() }, 30000); return () => clearInterval(timer) }, [load])
  const action = async (method: 'POST' | 'DELETE', body?: unknown) => {
    setBusy(true); setError(null)
    try {
      const response = await fetch('/api/integrations/mercadopago/setup', { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' })
      const result = await response.json() as { error?: string }
      if (!response.ok) {
        if (result.error === 'account_ambiguous') {
          const accountsResponse = await fetch('/api/integrations/mercadopago/account-link', { cache: 'no-store' })
          if (!accountsResponse.ok) throw new Error()
          const link = await accountsResponse.json() as { accounts: Array<{ id: string; name: string }> }
          setAccountChoices(link.accounts)
          setError('Encontramos más de una cuenta Mercado Pago. Elegí cuál representa tu saldo.')
        } else {
          setError(result.error === 'sync_busy' ? 'La conexión se está actualizando. Intentá en unos minutos.' : 'No pudimos completar la acción. Intentá de nuevo.')
        }
        return
      }
      setAccountChoices([])
      await load()
    } catch { setError('No pudimos completar la acción. Intentá de nuevo.') }
    finally { setBusy(false) }
  }
  const resolveAccount = async () => {
    if (!selectedAccount) return
    setBusy(true)
    try {
      const response = await fetch('/api/integrations/mercadopago/account-link', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: selectedAccount }) })
      if (!response.ok) throw new Error()
      await action('POST', { preset })
    } catch { setError('No pudimos vincular esa cuenta. Intentá de nuevo.') }
    finally { setBusy(false) }
  }
  if (!state) return <p role="status" className="mt-4 text-[13px]">{error ?? 'Cargando Mercado Pago…'}</p>
  if (!state.available) return null
  return <>
    <MercadoPagoSetupView state={state} preset={preset} setPreset={setPreset} busy={busy} error={error} onStart={() => void action('POST', { preset })} onResume={() => void action('POST', { resume: true })} onDisconnect={() => void action('DELETE')} />
    {accountChoices.length > 0 && <div className="mt-3 rounded-card border border-border-subtle p-4">
      <label htmlFor="mp-resolve-account" className="text-[13px] font-semibold">Cuenta que representa tu saldo Mercado Pago</label>
      <select id="mp-resolve-account" value={selectedAccount} disabled={busy} onChange={event => setSelectedAccount(event.target.value)} className="mt-2 min-h-11 w-full rounded-button border border-border-subtle bg-bg-primary px-3 text-[13px]">
        <option value="">Elegí una cuenta</option>{accountChoices.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
      </select>
      <button type="button" disabled={busy || !selectedAccount} onClick={() => void resolveAccount()} className="mt-3 min-h-11 rounded-button bg-primary px-4 text-[13px] font-semibold text-white disabled:opacity-50">Vincular y continuar</button>
    </div>}
  </>
}
