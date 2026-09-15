'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowsClockwise, ArrowSquareOut, Wallet } from '@phosphor-icons/react'
import { getMercadoPagoValidationMessage } from '@/lib/mercadopago/sync-presentation'

type Source = { status: 'success' | 'error' | 'not_run'; count: number }
type State = {
  state: 'not_connected' | 'connected' | 'error'
  lastSyncAt: string | null
  sources: { payments: Source; reports: Source }
}
type Diagnostic = { nativeId: string | null; occurredAt: string | null; kind: string; direction: string; amount: { value: number | null; currency: string | null }; operation: { status: string | null; statusDetail: string | null }; fundingSource: { kind: string }; channel: string; installments: number | null; confidence: string; description: string | null }
type DiagnosticState = { aggregates: Record<string, number>; movements: Diagnostic[] }

function sourceLabel(source: Source) {
  if (source.status === 'not_run') return 'Todavía sin validación'
  if (source.status === 'error') return 'No disponible'
  return `Validada · ${source.count}`
}

export function MercadoPagoSettingsCard() {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [diagnostics, setDiagnostics] = useState<DiagnosticState | null>(null)
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false)

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
      if (!result.ok) throw new Error('sync_failed')
      const payload = await result.json() as Pick<State, 'sources'>
      setMessage(getMercadoPagoValidationMessage(payload.sources))
      await load()
    } catch {
      setMessage('No se pudo completar la validación.')
    } finally {
      setBusy(false)
    }
  }

  const loadDiagnostics = async () => {
    setDiagnosticsBusy(true)
    try {
      const result = await fetch('/api/integrations/mercadopago/movements', { cache: 'no-store' })
      if (!result.ok) throw new Error('diagnostics_failed')
      setDiagnostics(await result.json() as DiagnosticState)
    } finally {
      setDiagnosticsBusy(false)
    }
  }

  const labels: Record<string, string> = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia', neutral: 'Técnica', unknown: 'Desconocida', outflow: 'Salida', inflow: 'Entrada', internal: 'Interna', mercadopago_balance: 'Saldo MP', card: 'Tarjeta', bank_transfer: 'Cuenta externa', CHECKOUT: 'Checkout', INSTORE: 'Presencial', SUBSCRIPTIONS: 'Suscripciones', PSP_TRANSFER: 'Transferencia PSP', UNSPECIFIED: 'Sin canal' }
  const label = (value: string | null | undefined) => value ? (labels[value] ?? value) : 'Sin dato'

  const current = state?.state ?? 'not_connected'
  return (
    <section className="mt-8" aria-labelledby="mercadopago-title">
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
              {current !== 'not_connected' ? (
                <button type="button" onClick={() => void sync()} disabled={busy} className="inline-flex items-center gap-2 rounded-button bg-primary px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">
                  <ArrowsClockwise size={14} />{busy ? 'Validando…' : 'Sincronizar ahora'}
                </button>
              ) : (
                <Link href="/api/integrations/mercadopago/connect" className="inline-flex items-center gap-2 rounded-button bg-primary px-4 py-2.5 text-[13px] font-semibold text-white">
                  <ArrowSquareOut size={14} />Conectar Mercado Pago
                </Link>
              )}
            </div>
            {current === 'connected' && <button type="button" onClick={() => void loadDiagnostics()} disabled={diagnosticsBusy} className="mt-3 text-[12px] font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50">{diagnosticsBusy ? 'Cargando operaciones…' : 'Ver operaciones detectadas'}</button>}
            {diagnostics && <div className="mt-3" aria-label="Diagnóstico de operaciones">
              <p className="text-[11px] text-text-secondary">Diagnóstico; todavía no se importa.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(['total', 'expense', 'transfer', 'neutral', 'unknown', 'partial'] as const).map((key) => <span key={key} className="rounded-full bg-bg-secondary px-2 py-1 text-[10px] font-semibold">{key === 'total' ? 'Total' : label(key)} · {diagnostics.aggregates[key] ?? 0}</span>)}
              </div>
              <div className="mt-2 space-y-2">
                {diagnostics.movements.map((movement) => <div key={`${movement.nativeId ?? 'unknown'}-${movement.occurredAt ?? 'unknown'}`} className="rounded-lg border border-border-ocean p-2 text-[11px]">
                  <div className="flex items-start justify-between gap-2"><span className="font-semibold">{label(movement.kind)} · {label(movement.direction)}</span><span>{movement.amount.value ?? '—'} {movement.amount.currency ?? ''}</span></div>
                  <div className="mt-1 text-text-secondary">{movement.description ?? 'Sin descripción'} · {movement.occurredAt ? new Date(movement.occurredAt).toLocaleDateString('es-AR') : 'Sin fecha'} · {label(movement.fundingSource.kind)} · {label(movement.channel)}</div>
                  <div className="mt-1 text-text-tertiary">{movement.operation.status ?? 'Sin estado'}{movement.operation.statusDetail ? ` · ${movement.operation.statusDetail}` : ''}{movement.installments ? ` · ${movement.installments} cuotas` : ''} · {movement.confidence === 'confirmed' ? 'Confirmada' : movement.confidence === 'partial' ? 'Parcial' : 'Desconocida'}</div>
                </div>)}
              </div>
            </div>}
            {message && <p className="mt-3 text-[12px] text-text-secondary" role="status">{message}</p>}
          </div>
        </div>
      </div>
    </section>
  )
}
