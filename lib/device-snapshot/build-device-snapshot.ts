import { computeSameDaySpend } from '@/lib/intelligence/features'
import type { FinancialSnapshot } from '@/lib/intelligence/types'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'

export type DeviceSnapshot = {
  schema_version: 1
  as_of: string
  currency: 'ARS' | 'USD'
  balances: {
    saldo_vivo: number
    disponible_real: number
    libre_hoy: number
    card_commitments: number
  }
  cards: Array<{
    id: string
    name: string
    current_spend: number
    debt_total: number
    days_until_closing: number | null
    due_date: string | null
    days_until_due: number | null
    cycle_status: 'en_curso' | 'cerrado' | 'vencido' | 'pagado'
  }>
  pace: {
    available: boolean
    current_amount: number
    baseline_amount: number | null
    baseline_kind: 'previous_month' | 'rolling_average' | null
    baseline_window: number
    baseline_label: string | null
    delta_percent: number | null
  }
}

function assertFiniteAmount(value: number, field: string): number {
  if (!Number.isFinite(value)) throw new Error(`Invalid device snapshot amount: ${field}`)
  return value
}

function cardPriority(status: DeviceSnapshot['cards'][number]['cycle_status']): number {
  return { vencido: 0, cerrado: 1, en_curso: 2, pagado: 3 }[status]
}

function spanishMonth(month: string): string {
  const date = new Date(`${month}-15T12:00:00.000Z`)
  return new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' }).format(date)
}

function paceLabel(feature: ReturnType<typeof computeSameDaySpend>, snapshot: FinancialSnapshot): string | null {
  if (!feature.baselineKind) return null
  if (feature.baselineKind === 'previous_month') {
    const [year, month] = snapshot.month.split('-').map(Number)
    const previousMonth = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`
    return `vs. ${spanishMonth(previousMonth)} al día ${snapshot.dayOfMonth}`
  }
  return `vs. promedio de ${feature.baselineWindow} meses al día ${snapshot.dayOfMonth}`
}

export function buildDeviceSnapshot(params: {
  dashboard: DashboardApiData
  financialSnapshot: FinancialSnapshot
  now?: Date
}): DeviceSnapshot {
  const { dashboard, financialSnapshot, now = new Date() } = params
  const currency = dashboard.viewCurrency
  const saldoVivo = assertFiniteAmount(dashboard.heroBreakdown[currency], 'saldo_vivo')
  const disponibleReal = assertFiniteAmount(dashboard.availableBreakdown[currency], 'disponible_real')
  const libreHoy = assertFiniteAmount(dashboard.freeBreakdown[currency], 'libre_hoy')
  const cardCommitments = assertFiniteAmount(saldoVivo - disponibleReal, 'card_commitments')

  const cards = (dashboard.compromisos?.tarjetas ?? [])
    .filter((card) => card.currentSpend > 0 || card.debtTotal > 0)
    .map((card) => ({
      id: card.id,
      name: card.name,
      current_spend: assertFiniteAmount(card.currentSpend, 'card.current_spend'),
      debt_total: assertFiniteAmount(card.debtTotal, 'card.debt_total'),
      days_until_closing: card.daysUntilClosing,
      due_date: card.dueDate,
      days_until_due: card.daysUntilDue,
      cycle_status: card.cycleStatus ?? 'en_curso',
    }))
    .sort((left, right) => {
      const byStatus = cardPriority(left.cycle_status) - cardPriority(right.cycle_status)
      if (byStatus !== 0) return byStatus
      return right.debt_total + right.current_spend - (left.debt_total + left.current_spend)
    })
    .slice(0, 2)

  const feature = computeSameDaySpend(financialSnapshot)
  const paceAvailable = feature.dataQuality !== 'insufficient' && feature.baselineAmount !== null

  return {
    schema_version: 1,
    as_of: now.toISOString(),
    currency,
    balances: {
      saldo_vivo: saldoVivo,
      disponible_real: disponibleReal,
      libre_hoy: libreHoy,
      card_commitments: cardCommitments,
    },
    cards,
    pace: {
      available: paceAvailable,
      current_amount: assertFiniteAmount(feature.currentAmount, 'pace.current_amount'),
      baseline_amount: paceAvailable ? assertFiniteAmount(feature.baselineAmount as number, 'pace.baseline_amount') : null,
      baseline_kind: paceAvailable ? feature.baselineKind : null,
      baseline_window: paceAvailable ? feature.baselineWindow : 0,
      baseline_label: paceAvailable ? paceLabel(feature, financialSnapshot) : null,
      delta_percent: paceAvailable ? feature.deltaPct : null,
    },
  }
}
