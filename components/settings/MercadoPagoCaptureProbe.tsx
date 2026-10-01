'use client'

import { useState } from 'react'

type Result = { observed: number[]; rawBefore: number; rawAfter: number[]; replay: 'stable' | 'no_events' | 'inconclusive'; shadowCount: number }

/** Only rendered by preview setup; the server independently enforces preview + session + origin. */
export function MercadoPagoCaptureProbe() {
  const [day, setDay] = useState(() => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = async () => {
    setBusy(true); setResult(null); setError(null)
    try {
      const response = await fetch('/api/integrations/mercadopago/capture-probe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day }), cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error === 'not_connected' ? 'La conexión necesita reconectarse.' : data.error === 'sync_busy' ? 'La conexión está ocupada. Intentá más tarde.' : data.error === 'probe_capture_incomplete' ? 'La consulta no se completó. No se validó la repetición.' : 'No se pudo completar la prueba.')
        return
      }
      setResult(data as Result)
    } catch { setError('No se pudo completar la prueba.') }
    finally { setBusy(false) }
  }
  return <div className="mt-4 border-t border-border-subtle pt-3">
    <p className="text-[13px] font-semibold">Prueba de captura</p>
    <p className="mt-2 text-[12px] text-text-secondary">Consulta un día dos veces y guarda evidencia. No inicia la importación ni registra gastos, saldos o compromisos.</p>
    <label className="mt-3 block text-[12px]">Día en Argentina<input type="date" value={day} onChange={event => setDay(event.target.value)} disabled={busy} className="mt-1 block min-h-11 rounded-button border border-border-subtle bg-bg-primary px-3" /></label>
    <button type="button" disabled={busy || !day} onClick={() => void run()} className="mt-3 min-h-11 text-[13px] font-semibold text-primary disabled:opacity-50">{busy ? 'Probando captura…' : 'Probar sin registrar gastos'}</button>
    {result && <p role="status" className="mt-3 text-[12px] text-text-secondary">Consultas: {result.observed.join(' / ')} movimientos. Evidencias guardadas: {result.rawBefore} → {result.rawAfter.join(' → ')}. {result.replay === 'stable' ? 'Repetición sin nuevas filas.' : result.replay === 'no_events' ? 'Ese día no hubo movimientos; no valida deduplicación con operaciones.' : 'La evidencia cambió entre consultas; resultado no concluyente.'} Evaluaciones shadow: {result.shadowCount}. Gastos registrados: 0.</p>}
    {error && <p role="alert" className="mt-3 text-[12px] text-error">{error}</p>}
  </div>
}
