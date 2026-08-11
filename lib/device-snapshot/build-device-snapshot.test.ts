import { describe, expect, it } from 'vitest'
import { buildDeviceSnapshot } from './build-device-snapshot'
import { makeSnapshot } from '@/lib/intelligence/__tests__/fixtures'
import type { DashboardApiData } from '@/lib/server/dashboard-queries'

function dashboardFixture(overrides: Partial<DashboardApiData> = {}): DashboardApiData {
  return {
    dashboardData: null,
    heroBalanceMode: 'combined_ars',
    heroBreakdown: { ARS: 1_250_000, USD: 0 },
    availableBreakdown: { ARS: 890_000, USD: 0 },
    goalCommitmentsBreakdown: { ARS: 130_000, USD: 0 },
    freeBreakdown: { ARS: 760_000, USD: 0 },
    accounts: [],
    cards: [],
    currency: 'ARS',
    viewCurrency: 'ARS',
    hasIncomeAfterRollover: true,
    autoRolloverAmount: null,
    manualRolloverSummary: null,
    activeSubscriptions: [],
    allUltimos: [],
    incomeEntries: [],
    transfers: [],
    transferCurrencyAdjustment: 0,
    earliestDataMonth: '2026-02',
    hasUsdExpenses: false,
    selectedMonth: '2026-07',
    isCurrentMonth: true,
    isProjected: false,
    yieldAccumulators: [],
    activeInstruments: [],
    capitalInstrumentosMes: 0,
    recurringPending: [],
    activeRecurring: [],
    compromisos: {
      mode: 'current',
      totalDebt: 92_000,
      pctComprometido: null,
      ingresoMes: null,
      tarjetas: [
        {
          id: 'visa',
          name: 'Visa',
          closingDay: 14,
          dueDay: 20,
          currentSpend: 184_000,
          daysUntilClosing: 3,
          debtTotal: 0,
          debtCycles: [],
          cycleStatus: 'en_curso',
          dueDate: null,
          daysUntilDue: null,
          amountPaid: null,
          paidAt: null,
          pendingSubs: [],
        },
        {
          id: 'mastercard',
          name: 'Mastercard',
          closingDay: 8,
          dueDay: 18,
          currentSpend: 0,
          daysUntilClosing: null,
          debtTotal: 92_000,
          debtCycles: [{ periodMonth: '2026-06', amount: 92_000, dueDate: '2026-07-18', cycleStatus: 'cerrado' }],
          cycleStatus: 'cerrado',
          dueDate: '2026-07-18',
          daysUntilDue: 4,
          amountPaid: null,
          paidAt: null,
          pendingSubs: [],
        },
      ],
      tarjetasSinVencimiento: [],
      hasCards: true,
      hasCreditExpenses: true,
      totalComprometido: 276_000,
      unassignedCreditSpend: 0,
      totalAPagar: 92_000,
      totalEnCurso: 184_000,
    },
    accountBalances: [],
    cardPaymentPrompts: [],
    goals: [],
    ...overrides,
  }
}

describe('buildDeviceSnapshot', () => {
  it('construye un snapshot mínimo con balances canónicos, tarjetas priorizadas y ritmo same-day', () => {
    const result = buildDeviceSnapshot({
      dashboard: dashboardFixture(),
      financialSnapshot: makeSnapshot(),
      now: new Date('2026-07-15T15:00:00.000Z'),
    })

    expect(result).toMatchObject({
      schema_version: 1,
      currency: 'ARS',
      balances: {
        saldo_vivo: 1_250_000,
        disponible_real: 890_000,
        libre_hoy: 760_000,
        card_commitments: 360_000,
      },
      cards: [
        { id: 'mastercard', cycle_status: 'cerrado', debt_total: 92_000 },
        { id: 'visa', cycle_status: 'en_curso', current_spend: 184_000 },
      ],
      pace: {
        available: true,
        current_amount: 140_000,
        baseline_amount: 140_000,
        baseline_kind: 'rolling_average',
        baseline_window: 5,
        baseline_label: 'vs. promedio de 5 meses al día 15',
        delta_percent: 0,
      },
    })
    expect(result.as_of).toBe('2026-07-15T15:00:00.000Z')
  })
})
