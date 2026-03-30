import type { Expense } from '@/types/database'

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Calcula el monto total a pagar en el resumen de una tarjeta
 * para un período dado [periodoDesde, periodoHasta] (ambos extremos inclusivos).
 *
 * Las compras en cuotas ya están pre-divididas en la DB — cada row tiene
 * el monto de la cuota correspondiente, no el total. Se suma `amount` directo.
 *
 * Se restan los `Pago de Tarjetas` ya registrados para esa tarjeta en el período,
 * para no sugerir un monto que ya fue (parcialmente) pagado.
 */
export function calcularMontoResumen(
  expenses: Expense[],
  cardId: string,
  periodoDesde: Date,
  periodoHasta: Date,
): number {
  const desdeStr = toDateStr(periodoDesde)
  const hastaStr = toDateStr(periodoHasta)

  const estaEnPeriodo = (e: Expense): boolean => {
    const d = e.date.substring(0, 10) // YYYY-MM-DD
    return d >= desdeStr && d <= hastaStr
  }

  const totalConsumos = expenses
    .filter(
      (e) =>
        e.card_id === cardId &&
        e.payment_method === 'CREDIT' &&
        e.category !== 'Pago de Tarjetas' &&
        estaEnPeriodo(e),
    )
    .reduce((sum, e) => sum + e.amount, 0)

  const totalPagosYaRealizados = expenses
    .filter(
      (e) =>
        e.card_id === cardId &&
        e.category === 'Pago de Tarjetas' &&
        estaEnPeriodo(e),
    )
    .reduce((sum, e) => sum + e.amount, 0)

  return Math.max(0, totalConsumos - totalPagosYaRealizados)
}
