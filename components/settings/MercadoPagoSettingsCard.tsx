'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowsClockwise, ArrowSquareOut, Wallet } from '@phosphor-icons/react'

type Source = { status: 'success' | 'error' | 'not_run'; count: number; errorCode: 'provider_error' | null }
type State = {
  state: 'not_connected' | 'connected' | 'error'
  lastSyncAt: string | null
  sources: { payments: Source; reports: Source }
}

function sourceLabel(source: Source) {
  if (source.status === 'not_run') return 'Todavía sin validación'
  if (source.status === 'error') return `No disponible · ${source.errorCode ?? 'error'}`
  return `Validada · ${source.count}`
}

export function MercadoPagoSettingsCard() {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)

  const load = async () => {
    setLoadError(false)
    try {
      const result = await fetch('/api/integrations/mercadopago/sync', { cache: 'no-store' })
      if (!result.ok) throw new Error('settings_load_failed')
      setState(await result.json() as State)
    } catch {
      setLoadError(true)
    }
  }

  useEffect(() => { void load() }, [])

  const sync = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await fetch('/api/integrations/mercadopago/sync', { method: 'POST', cache: 'no-store' })
      setMessage(result.ok ? 'Validación completada. Nada se importó al registro financiero.' : 'No se pudo completar la validación.')
      await load()
    } catch {
      setMessage('No se pudo completar la validación.')
    } finally {
      setBusy(false)
    }
  }

  const current = state?.state ?? 'not_connected'
  return (
    <section className="mt-8" aria-labelledby="mercadopago-title">
      <p className="mb-4 type-label text-text-label">Conexiones</p>
      <div className="card-s5 p-4">
        <div className="flex items-start gap-3">
          <Wallet size={22} className="text-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="mercadopago-title" className="text-[14px] font-bold">Mercado Pago</h3>
                <p className="mt-1 text-[12px] text-text-tertiary">Validación privada de solo lectura. Nada se importa al registro financiero.</p>
              </div>
              <span className="rounded-[20px] bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold">
                {current === 'connected' ? 'Conectado' : current === 'error' ? 'Con error' : 'No conectado'}
              </span>
            </div>

            {state === null && !loadError && <p className="mt-3 text-[12px] text-text-secondary">Cargando estado de conexión…</p>}
            {loadError && <p className="mt-3 text-[12px] text-error">No pudimos cargar el estado. Podés reintentar más tarde.</p>}
            {state?.lastSyncAt && <p className="mt-3 text-[12px] text-text-secondary">Última validación: {new Date(state.lastSyncAt).toLocaleString('es-AR')}</p>}

            <div className="mt-3 overflow-hidden rounded-lg border border-border-ocean" aria-label="Última validación por fuente">
              <div className="grid grid-cols-2 border-b border-border-ocean px-3 py-2 text-[11px] font-semibold"><span>Fuente</span><span>Estado · cantidad</span></div>
              <div className="grid grid-cols-2 px-3 py-2 text-[12px]"><span>Payments Search</span><span>{state ? sourceLabel(state.sources.payments) : '—'}</span></div>
              <div className="grid grid-cols-2 border-t border-border-ocean px-3 py-2 text-[12px]"><span>Settlement Report list</span><span>{state ? sourceLabel(state.sources.reports) : '—'}</span></div>
            </div>

            <div className="mt-4 flex gap-2">
              {current === 'connected' ? (
                <button type="button" onClick={() => void sync()} disabled={busy} className="inline-flex items-center gap-2 rounded-button bg-primary px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
                  <ArrowsClockwise size={14} />{busy ? 'Validando…' : 'Sincronizar ahora'}
                </button>
              ) : (
                <Link href="/api/integrations/mercadopago/connect" className="inline-flex items-center gap-2 rounded-button bg-primary px-4 py-2.5 text-[13px] font-semibold text-white">
                  <ArrowSquareOut size={14} />Conectar Mercado Pago
                </Link>
              )}
            </div>
            {message && <p className="mt-3 text-[12px] text-text-secondary" role="status">{message}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
