import { describe, expect, it } from 'vitest'
import {
  calculateDailyYieldAmount,
  inferTnaFromDailyAmount,
  parseBnaYieldCsv,
  reconcileYieldEntry,
  sumYieldEntriesForBalance,
} from './yield-daily'

describe('calculateDailyYieldAmount', () => {
  it('uses the configured cap before applying TNA', () => {
    expect(
      calculateDailyYieldAmount({
        balance: 8_904_550.4,
        rateTna: 14,
        capAmount: 2_000_000,
      }),
    ).toBe(767.12)
  })

  it('uses the full positive balance when it is below the cap', () => {
    expect(
      calculateDailyYieldAmount({
        balance: 1_000_000,
        rateTna: 14,
        capAmount: 2_000_000,
      }),
    ).toBe(383.56)
  })

  it('returns zero for non-positive balances or rates', () => {
    expect(calculateDailyYieldAmount({ balance: -1, rateTna: 14, capAmount: 2_000_000 })).toBe(0)
    expect(calculateDailyYieldAmount({ balance: 2_000_000, rateTna: 0, capAmount: 2_000_000 })).toBe(0)
  })
})

describe('parseBnaYieldCsv', () => {
  it('extracts BNA daily yield rows and normalizes Argentine money/date formats', () => {
    const rows = parseBnaYieldCsv(`Fecha,Comprobante,Concepto,Monto,Saldo
25/06/2026,0,RENDIMIENTO DIARIO PESOS,"$ 767,12","$ 8.905.317,52"
25/06/2026,7671,PAGO CON TRANSFERENCIA,"$ -12.200,00","$ 8.917.517,52"
24/06/2026,0,RENDIMIENTO DIARIO PESOS,"$ 767,12","$ 8.990.050,40"`)

    expect(rows).toEqual([
      {
        date: '2026-06-25',
        comprobante: '0',
        concept: 'RENDIMIENTO DIARIO PESOS',
        amount: 767.12,
        statementBalance: 8_905_317.52,
      },
      {
        date: '2026-06-24',
        comprobante: '0',
        concept: 'RENDIMIENTO DIARIO PESOS',
        amount: 767.12,
        statementBalance: 8_990_050.4,
      },
    ])
  })
})

describe('yield reconciliation helpers', () => {
  it('marks equal expected and actual amounts as matched', () => {
    expect(reconcileYieldEntry({ expectedAmount: 767.12, actualAmount: 767.12 })).toBe('matched')
  })

  it('marks cent-level differences beyond tolerance as difference', () => {
    expect(reconcileYieldEntry({ expectedAmount: 767.12, actualAmount: 768 })).toBe('difference')
  })

  it('uses actual amounts before expected amounts in balance totals', () => {
    expect(
      sumYieldEntriesForBalance([
        { expectedAmount: 700, actualAmount: 767.12 },
        { expectedAmount: 767.12, actualAmount: null },
      ]),
    ).toBe(1534.24)
  })

  it('infers TNA from a capped daily amount', () => {
    expect(inferTnaFromDailyAmount({ dailyAmount: 767.12, capAmount: 2_000_000 })).toBe(14)
  })
})
