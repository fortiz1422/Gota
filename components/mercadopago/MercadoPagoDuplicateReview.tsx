'use client'
import { useEffect, useState } from 'react'
import type { MercadoPagoMovement } from '@/lib/mercadopago/review'
import type { DuplicateExpenseSnapshot } from '@/lib/mercadopago/duplicate-resolution'
export type MercadoPagoDuplicateChoice = { action: 'link_existing' | 'keep_both'; expenseId?: string; fingerprint: string }
export function MercadoPagoDuplicateReview({ movement, onLink, onKeep }: {
  movement: MercadoPagoMovement;
  onLink: (choice: MercadoPagoDuplicateChoice, expense: DuplicateExpenseSnapshot) => Promise<void>;
  onKeep: (choice: MercadoPagoDuplicateChoice) => void;
}) {
  const [data, setData] = useState<{ expenses: DuplicateExpenseSnapshot[]; fingerprint: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    void fetch(`/api/integrations/mercadopago/movements/${encodeURIComponent(movement.candidateId)}/duplicates`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error === 'resolution_not_enabled' ? 'La resolución de duplicados todavía no está habilitada. El movimiento sigue pendiente.' : 'No pudimos comparar con tus gastos. Reintentá más tarde.')
        if (active) setData(body)
      }).catch(reason => { if (active) setError(reason.message) })
    return () => { active = false }
  }, [movement.candidateId])
  const link = async (expense: DuplicateExpenseSnapshot) => {
    if (!data) return
    setBusy(true);setError('')
    try { await onLink({ action: 'link_existing', expenseId: expense.id, fingerprint: data.fingerprint }, expense) }
    catch { setError('La comparación cambió o no se pudo guardar. Cerrá el detalle y revisá de nuevo.') }
    finally { setBusy(false) }
  }
  return <MercadoPagoDuplicateView data={data} error={error} busy={busy} onLink={expense => void link(expense)} onKeep={onKeep} />
}

export function MercadoPagoDuplicateView({ data, error = '', busy = false, onLink, onKeep }: {
  data: { expenses: DuplicateExpenseSnapshot[]; fingerprint: string } | null;
  error?: string;
  busy?: boolean;
  onLink: (expense: DuplicateExpenseSnapshot) => void;
  onKeep: (choice: MercadoPagoDuplicateChoice) => void;
}) {
  return <section className="mt-4 space-y-3" aria-label="Comparar posible duplicado">
    <p className="text-sm text-text-secondary">¿Es alguno de estos gastos? Vincularlo evita registrar otro.</p>
    {!data && !error && <p role="status">Comparando con tus gastos…</p>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {data?.expenses.map(expense => <article key={expense.id} className="rounded-card border border-border-subtle p-4">
      <p className="truncate text-sm font-semibold">{expense.description}</p>
      <p className="text-sm text-text-secondary">{expense.date} · {new Intl.NumberFormat('es-AR', { style: 'currency', currency: expense.currency }).format(expense.amount)}</p>
      <button type="button" disabled={busy} onClick={() => onLink(expense)} className="mt-3 min-h-11 w-full rounded-button border border-border-subtle px-4 text-sm font-semibold text-primary disabled:opacity-50">Es este gasto: vincular</button>
    </article>)}
    {data && data.expenses.length > 0 && <button type="button" disabled={busy} onClick={() => onKeep({ action: 'keep_both', fingerprint: data.fingerprint })} className="min-h-11 w-full rounded-button bg-primary px-4 text-sm font-semibold text-white">Es otro gasto</button>}
    {data && data.expenses.length === 0 && <p className="text-sm">Ya no encontramos gastos compatibles. Actualizá la bandeja antes de registrar.</p>}
  </section>
}
