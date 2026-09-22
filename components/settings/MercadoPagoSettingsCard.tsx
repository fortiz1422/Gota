'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowsClockwise, ArrowSquareOut, Wallet } from '@phosphor-icons/react'
import { getMercadoPagoValidationMessage } from '@/lib/mercadopago/sync-presentation'

type Source = { status: 'success' | 'error' | 'pending' | 'not_run'; count: number; observedInRun?: number; lastCompleteDate?: string | null }
type State = { state: 'not_connected' | 'connected' | 'error'; lastSyncAt: string | null; sources: { payments: Source; reports: Source }; sinceLastFullSync?: { available: boolean; beginDate: string | null } }
function sourceLabel(source: Source) { if (source.status === 'not_run') return 'Todavía sin validación'; if (source.status === 'error') return 'No disponible'; if (source.status === 'pending') return 'Preparando movimientos…'; return `Validada · ${source.count}` }

export function MercadoPagoSettingsCard() {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [preset, setPreset] = useState('7d')
  const [beginDate, setBeginDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const load = async () => {
    setError(false)
    try { const response = await fetch('/api/integrations/mercadopago/sync', { cache: 'no-store' }); if (!response.ok) throw new Error(); setState(await response.json() as State) } catch { setError(true) }
  }
  useEffect(() => { void load() }, [])
  const sync = async () => {
    setBusy(true); setMessage(null)
    try { const payload = preset === 'custom' ? { preset, beginDate, endDate } : { preset }; const response = await fetch('/api/integrations/mercadopago/sync', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const result = await response.json() as Pick<State, 'sources'> & { range?: { beginDate: string; endDate: string } }; if (!response.ok) throw new Error(); setMessage(`${getMercadoPagoValidationMessage(result.sources)}${result.range ? ` Rango: ${result.range.beginDate} a ${result.range.endDate}.` : ''}`); await load() } catch { setMessage('No se pudo validar ese rango.') } finally { setBusy(false) }
  }
  const current = state?.state ?? 'not_connected'
  return <section className="mt-8" aria-labelledby="mercadopago-title"><div className="card-s5 p-4"><div className="flex items-start gap-3"><Wallet size={22} className="text-primary" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h3 id="mercadopago-title" className="text-[14px] font-bold">Mercado Pago</h3><p className="mt-1 text-[12px] text-text-tertiary">Conexión y sincronización de tus fuentes de Mercado Pago.</p></div><span className="rounded-[20px] bg-bg-secondary px-2.5 py-1 text-[11px] font-semibold">{current === 'connected' ? 'Conectado' : current === 'error' ? 'Con error' : 'No conectado'}</span></div>
    {state === null && !error && <p className="mt-3 text-[12px] text-text-secondary">Cargando estado de conexión…</p>}
    {error && <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-error"><span>No pudimos cargar el estado.</span><button type="button" onClick={() => void load()} className="min-h-11 font-semibold underline">Reintentar</button></div>}
    {state?.lastSyncAt && <p className="mt-3 text-[12px] text-text-secondary">Última sincronización: {new Date(state.lastSyncAt).toLocaleString('es-AR')}</p>}
    <div className="mt-3 overflow-hidden rounded-lg border border-border-ocean"><div className="grid grid-cols-2 border-b border-border-ocean px-3 py-2 text-[11px] font-semibold"><span>Fuente</span><span>Estado · cantidad</span></div><div className="grid grid-cols-2 px-3 py-2 text-[12px]"><span>Movimientos</span><span>{state ? sourceLabel(state.sources.payments) : '—'}</span></div><div className="grid grid-cols-2 border-t border-border-ocean px-3 py-2 text-[12px]"><span>Saldo disponible</span><span>{state ? sourceLabel(state.sources.reports) : '—'}</span></div></div>
    {current !== 'not_connected' && <div className="mt-4 space-y-2"><label className="block text-[12px] font-semibold" htmlFor="mercadopago-sync-range">Período de consulta</label><select id="mercadopago-sync-range" value={preset} onChange={(event) => setPreset(event.target.value)} className="min-h-11 w-full rounded-button border border-border-ocean bg-white px-3 text-[13px]"><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option><option value="60d">Últimos 60 días</option>{state?.sinceLastFullSync?.available && <option value="since_last_full_sync">Desde última sincronización completa ({state.sinceLastFullSync.beginDate})</option>}<option value="custom">Rango personalizado</option></select>{preset === 'custom' && <div className="grid grid-cols-2 gap-2"><label className="text-[12px]">Desde<input type="date" value={beginDate} onChange={(event) => setBeginDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border-ocean px-2" /></label><label className="text-[12px]">Hasta<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-button border border-border-ocean px-2" /></label></div>}<div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => void sync()} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-button bg-primary px-4 text-[13px] font-semibold text-white disabled:opacity-50"><ArrowsClockwise size={14} />{busy ? 'Preparando…' : 'Sincronizar ahora'}</button><Link href="/mercadopago/review" className="inline-flex min-h-11 items-center rounded-button px-2 text-[13px] font-semibold text-primary underline-offset-2 hover:underline">Revisar operaciones</Link></div></div>}
    {current === 'not_connected' && <div className="mt-4 flex flex-wrap items-center gap-3"><Link href="/api/integrations/mercadopago/connect" className="inline-flex min-h-11 items-center gap-2 rounded-button bg-primary px-4 text-[13px] font-semibold text-white"><ArrowSquareOut size={14} />Conectar Mercado Pago</Link></div>}
    {message && <p className="mt-3 text-[12px] text-text-secondary" role="status">{message}</p>}
  </div></div></div></section>
}
