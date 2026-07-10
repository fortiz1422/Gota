import { describe, expect, it } from 'vitest'
import { buildHomeBrief } from '../home-brief'
import type { HomeDisplayContext } from '../home-display-context'
import {
  HISTORY_MONTHS,
  makeBudgetSnapshot,
  makeCard,
  makeFreshUserSnapshot,
  makeSnapshot,
  monthPatternExpenses,
} from './fixtures'

const displayContext: HomeDisplayContext = {
  heroBalanceMode: 'default_currency',
  viewCurrency: 'ARS',
  valuationRate: null,
  amountsVisible: true,
}

/** Resumen Visa cerrado que vence en 3 días y saldo que no lo cubre. */
function visaDueAndLiquidityRiskInputs() {
  return {
    saldoVivo: { ARS: 200_000, USD: 0 } as { ARS: number; USD: number },
    cards: [
      makeCard({
        pendingStatements: [
          { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-18', status: 'cerrado' },
        ],
      }),
    ],
  }
}

describe('buildHomeBrief — una lectura editorial', () => {
  it('compone una lectura calma con margen diario y sin señales secundarias', () => {
    const brief = buildHomeBrief(makeSnapshot(), displayContext)

    expect(brief.status).toBe('calm')
    expect(brief.headline).toMatch(/cubierto|margen/i)
    expect(brief.evidence.length).toBeLessThanOrEqual(2)
    expect(brief.secondaryCount).toBe(0)
    expect(brief.sourceInsightIds).toHaveLength(0)
  })

  it('un riesgo de liquidez es el titular y expone acción nativa a compromisos', () => {
    const brief = buildHomeBrief(makeSnapshot(visaDueAndLiquidityRiskInputs()), displayContext)

    expect(brief.status).toBe('risk')
    expect(brief.headline).toMatch(/saldo no cubre|Visa/i)
    expect(brief.primaryAction?.href).toContain('compromisos')
    expect(brief.askQuestion).not.toBeNull()
    expect(brief.evidence.length).toBeLessThanOrEqual(2)
  })

  it('con datos insuficientes no afirma que no hay nada urgente', () => {
    const brief = buildHomeBrief(makeFreshUserSnapshot(), displayContext)

    expect(brief.status).toBe('learning')
    expect(`${brief.headline} ${brief.summary}`).not.toMatch(/nada urgente|todo en orden|cubierto/i)
  })

  it('sin movimientos del mes pero con resumen por vencer, la lectura aparece igual', () => {
    const brief = buildHomeBrief(
      makeSnapshot({
        ...visaDueAndLiquidityRiskInputs(),
        expenses: HISTORY_MONTHS.flatMap((month) => monthPatternExpenses(month)),
      }),
      displayContext,
    )

    expect(brief.status).toBe('risk')
    expect(brief.headline).toMatch(/saldo no cubre|Visa/i)
  })
})

describe('buildHomeBrief — dedupe de señales correlacionadas', () => {
  it('usa una sola historia Visa cuando vencimiento y liquidez comparten causa', () => {
    const brief = buildHomeBrief(makeSnapshot(visaDueAndLiquidityRiskInputs()), displayContext)

    expect(brief.sourceInsightIds).toHaveLength(1)
    expect(brief.headline).toMatch(/Visa|saldo no cubre/i)
    expect(brief.summary.match(/Visa/g)?.length ?? 0).toBeLessThanOrEqual(1)
  })

  it('los secundarios cuentan solo dominios materialmente distintos', () => {
    const brief = buildHomeBrief(
      makeSnapshot({
        ...visaDueAndLiquidityRiskInputs(),
        budget: makeBudgetSnapshot([
          { category: 'Supermercado', amount: 150_000, spentAmount: 140_000 },
        ]),
      }),
      displayContext,
    )

    // Visa (correlacionada con la liquidez elegida) no cuenta; presupuesto sí.
    expect(brief.secondaryCount).toBe(1)
  })
})

describe('buildHomeBrief — base de display y masking', () => {
  it('modo default: la base es la moneda de vista sin cotización', () => {
    const brief = buildHomeBrief(makeSnapshot(), displayContext)

    expect(brief.moneyBasis).toEqual({
      mode: 'default_currency',
      currency: 'ARS',
      valuationRate: null,
    })
  })

  it('combinado ARS con cotización válida conserva modo y tasa', () => {
    const brief = buildHomeBrief(makeSnapshot(), {
      ...displayContext,
      heroBalanceMode: 'combined_ars',
      valuationRate: 1200,
    })

    expect(brief.moneyBasis).toEqual({ mode: 'combined_ars', currency: 'ARS', valuationRate: 1200 })
  })

  it('combinado USD con cotización válida conserva modo y tasa', () => {
    const brief = buildHomeBrief(makeSnapshot(), {
      ...displayContext,
      heroBalanceMode: 'combined_usd',
      viewCurrency: 'USD',
      valuationRate: 1200,
    })

    expect(brief.moneyBasis).toEqual({ mode: 'combined_usd', currency: 'USD', valuationRate: 1200 })
  })

  it('combinado sin cotización cae explícitamente a base default', () => {
    const brief = buildHomeBrief(makeSnapshot(), {
      ...displayContext,
      heroBalanceMode: 'combined_ars',
      valuationRate: null,
    })

    expect(brief.moneyBasis.mode).toBe('default_currency')
    expect(brief.moneyBasis.valuationRate).toBeNull()
  })

  it('con montos ocultos no queda ningún monto formateado en la lectura', () => {
    const masked = buildHomeBrief(makeSnapshot(), { ...displayContext, amountsVisible: false })

    const rendered = [
      masked.headline,
      masked.summary,
      ...masked.evidence.map((item) => item.value),
    ].join(' ')
    expect(rendered).not.toMatch(/(?:USD|\$)\s?[\d.,]+/)
  })

  it('con montos ocultos la lectura de riesgo también se enmascara', () => {
    const masked = buildHomeBrief(makeSnapshot(visaDueAndLiquidityRiskInputs()), {
      ...displayContext,
      amountsVisible: false,
    })

    const rendered = [
      masked.headline,
      masked.summary,
      ...masked.evidence.map((item) => item.value),
    ].join(' ')
    expect(rendered).not.toMatch(/(?:USD|\$)\s?[\d.,]+/)
    // El título puede quedar: sigue habiendo lectura, sin números.
    expect(masked.status).toBe('risk')
  })
})
