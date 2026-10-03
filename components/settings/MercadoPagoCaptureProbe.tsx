'use client'

import { useState } from 'react'

type RoleResult = { roles: { role: string; status: string; observed: number; unique: number }[]; unique: number; complete: boolean; window: { begin: string; end: string } }

type SettlementResult = { window?: { begin: string; end: string }; availability?: { matched: number; pending: number; missingFile: number; processed: number; taskStates?: string[]; linkedReports?: number; searchResults?: number; searchExact?: number }; status: 'success' | 'pending' | 'error'; observed: number; shadowCount: number }

type Result = { observed: number[]; rawBefore: number; rawAfter: number[]; replay: 'stable' | 'no_events' | 'inconclusive'; shadowCount: number }

/** Only rendered by preview setup; the server independently enforces preview + session + origin. */
export function MercadoPagoCaptureProbe() {
  const [day, setDay] = useState(() => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10))
  const [settlementResult, setSettlementResult] = useState<SettlementResult | null>(null)
  const [roleResult, setRoleResult] = useState<RoleResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = async (source: 'payments' | 'settlement' | 'roles' = 'payments') => {
    setBusy(true); setResult(null); setSettlementResult(null); setRoleResult(null); setError(null)
    try {
      const response = await fetch('/api/integrations/mercadopago/capture-probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day, source }), cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error === 'not_connected' ? 'La conexión necesita reconectarse.' : data.error === 'sync_busy' ? 'La conexión está ocupada. Intentá más tarde.' : data.error === 'probe_capture_incomplete' ? 'La consulta no se completó. No se validó la repetición.' : 'No se pudo completar la prueba.')
        return
      }
      if (source === 'settlement') setSettlementResult(data as SettlementResult)
      else if (source === 'roles') setRoleResult(data as RoleResult)
      else setResult(data as Result)
    } catch { setError('No se pudo completar la prueba.') }
    finally { setBusy(false) }
  }
  return <div className="mt-4 border-t border-border-subtle pt-3">
    <p className="text-[13px] font-semibold">Prueba de captura</p>
    <p className="mt-2 text-[12px] text-text-secondary">Consulta un día dos veces y guarda evidencia. No inicia la importación ni registra gastos, saldos o compromisos.</p>
    <label className="mt-3 block text-[12px]">Día en Argentina<input type="date" value={day} onChange={event => setDay(event.target.value)} disabled={busy} className="mt-1 block min-h-11 rounded-button border border-border-subtle bg-bg-primary px-3" /></label>
    <button type="button" disabled={busy || !day} onClick={() => void run('payments')} className="mt-3 min-h-11 text-[13px] font-semibold text-primary disabled:opacity-50">{busy ? 'Probando captura…' : 'Probar sin registrar gastos'}</button>
    <button type="button" disabled={busy || !day} onClick={() => void run('settlement')} className="mt-2 block min-h-11 text-[13px] font-semibold text-primary disabled:opacity-50">Consultar reporte de saldo</button>
    <button type="button" disabled={busy || !day} onClick={() => void run('roles')} className="mt-2 block min-h-11 text-[13px] font-semibold text-primary disabled:opacity-50">Comparar pagador y receptor</button>
    {roleResult && <p role="status" className="mt-3 text-[12px] text-text-secondary">{roleResult.roles.map(role => `${role.role}: ${role.observed} (${role.status})`).join('; ')}. IDs únicos entre consultas: {roleResult.unique}. {roleResult.complete ? 'Consultas completas; esto no confirma una operación específica.' : 'Comparación incompleta.'} Período: {roleResult.window.begin} → {roleResult.window.end}. Gastos registrados: 0.</p>}
    {settlementResult && <p role="status" className="mt-3 text-[12px] text-text-secondary">{settlementResult.status === 'pending' ? 'El reporte todavía no está disponible para descargar.' : settlementResult.status === 'error' ? 'No se pudo consultar el reporte. No se modificó su configuración.' : `Reporte recibido: ${settlementResult.observed} movimientos. Evaluaciones shadow: ${settlementResult.shadowCount}.`} Gastos registrados: 0. {settlementResult.window && `Período: ${settlementResult.window.begin} → ${settlementResult.window.end}. `}{settlementResult.availability && `Reportes coincidentes: ${settlementResult.availability.matched}; pendientes: ${settlementResult.availability.pending}; procesados: ${settlementResult.availability.processed}; sin archivo utilizable: ${settlementResult.availability.missingFile}. Estados de tarea: ${settlementResult.availability.taskStates?.join(', ') ?? 'sin datos'}; referencias a reporte: ${settlementResult.availability.linkedReports ?? 0}; resultados de búsqueda: ${settlementResult.availability.searchResults ?? 0}; período exacto: ${settlementResult.availability.searchExact ?? 0}.`}</p>}
    {result && <p role="status" className="mt-3 text-[12px] text-text-secondary">Consultas: {result.observed.join(' / ')} movimientos. Evidencias guardadas: {result.rawBefore} → {result.rawAfter.join(' → ')}. {result.replay === 'stable' ? 'Repetición sin nuevas filas.' : result.replay === 'no_events' ? 'La consulta no devolvió movimientos; no valida deduplicación con operaciones.' : 'La evidencia cambió entre consultas; resultado no concluyente.'} Evaluaciones shadow: {result.shadowCount}. Gastos registrados: 0.</p>}
    {error && <p role="alert" className="mt-3 text-[12px] text-error">{error}</p>}
  </div>
}
