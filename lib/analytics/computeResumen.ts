import type { Expense } from '@/types/database'

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Calcula el gasto bruto de una tarjeta en un período [periodoDesde, periodoHasta]
 * (ambos extremos inclusivos).
 *
 * Devuelve la suma de todos los gastos CREDIT del período, sin deducir pagos.
 * Los "Pago de Tarjetas" son eventos de un ciclo distinto (pagan el resumen anterior)
 * y no deben reducir el monto del ciclo actual.
 *
 * Las compras en cuotas ya están pre-divididas en la DB: se suma `amount` directo.
 */
export function calcularMontoResumen(
  expenses: Expense[],
  cardId: string,
  periodoDesde: Date,
  periodoHasta: Date,
): number {
  const desdeStr = toDateStr(periodoDesde)
  const hastaStr = toDateStr(periodoHasta)

  return expenses
    .filter(
      (e) =>
        e.card_id === cardId &&
        e.payment_method === 'CREDIT' &&
        e.category !== 'Pago de Tarjetas' &&
        e.date.substring(0, 10) >= desdeStr &&
        e.date.substring(0, 10) <= hastaStr,
    )
    .reduce((sum, e) => sum + e.amount, 0)
}
