import { describe, expect, it } from 'vitest'
import { computeSameDaySpend } from '../features'
import { assembleFinancialSnapshot, fetchExpenseRows, type SnapshotExpenseRow } from '../snapshot'
import { makeInputs, makeSnapshot } from './fixtures'

describe('cobertura del snapshot — truncamiento explícito', () => {
  it('marca una fuente como potencialmente truncada cuando trae exactamente el límite', () => {
    const inputs = makeInputs()
    const snapshot = assembleFinancialSnapshot({
      ...inputs,
      sourceLimits: {
        expenses: inputs.expenses.length,
        incomes: 200,
        transfers: 200,
      },
    })

    expect(snapshot.coverage.expenses.truncated).toBe(true)
    expect(snapshot.coverage.expenses.fetched).toBe(inputs.expenses.length)
    expect(snapshot.coverage.expenses.limit).toBe(inputs.expenses.length)
    expect(snapshot.coverage.incomes.truncated).toBe(false)
    expect(snapshot.coverage.transfers.truncated).toBe(false)
  })

  it('menos filas que el límite no es truncamiento', () => {
    const inputs = makeInputs()
    const snapshot = assembleFinancialSnapshot({
      ...inputs,
      sourceLimits: { expenses: 500, incomes: 200, transfers: 200 },
    })

    expect(snapshot.coverage.expenses.truncated).toBe(false)
    expect(snapshot.coverage.incomes.truncated).toBe(false)
  })

  it('sin límites declarados (fixtures puras) nunca reclama truncamiento', () => {
    const snapshot = makeSnapshot()

    expect(snapshot.coverage.expenses.truncated).toBe(false)
    expect(snapshot.coverage.historyStartDate).toBe('2026-02-01')
  })

  it('degrada la calidad del baseline histórico cuando el histórico puede estar truncado', () => {
    const inputs = makeInputs()
    const complete = assembleFinancialSnapshot(inputs)
    const truncated = assembleFinancialSnapshot({
      ...inputs,
      sourceLimits: { expenses: inputs.expenses.length, incomes: 200, transfers: 200 },
    })

    // Base estable de 5 meses: sin truncamiento la calidad es plena.
    expect(computeSameDaySpend(complete).dataQuality).toBe('ok')
    expect(computeSameDaySpend(truncated).dataQuality).toBe('partial')
  })
})

describe('fetchExpenseRows — histórico paginado', () => {
  it('recupera filas posteriores a la primera página sin marcar un corte artificial en 500', async () => {
    const rows: SnapshotExpenseRow[] = Array.from({ length: 604 }, (_, index) => ({
      id: `expense-${index + 1}`,
      amount: 1_000,
      currency: 'ARS',
      category: 'Supermercado',
      description: 'Compra',
      is_want: false,
      payment_method: 'DEBIT',
      is_legacy_card_payment: null,
      date: `2026-${String(2 + Math.floor(index / 110)).padStart(2, '0')}-15`,
      installment_number: null,
      installment_total: null,
      is_extraordinary: false,
    }))
    const ranges: Array<[number, number]> = []
    const query = {
      eq: () => query,
      gte: () => query,
      lt: () => query,
      not: () => query,
      order: () => query,
      range: async (from: number, to: number) => {
        ranges.push([from, to])
        return { data: rows.slice(from, to + 1), error: null }
      },
    }
    const supabase = {
      from: () => ({ select: () => query }),
    }

    const result = await fetchExpenseRows({
      supabase: supabase as never,
      userId: 'user-test',
      fromDate: '2026-02-01',
      toDate: '2026-08-01',
      pageSize: 500,
      maxRows: 2_000,
    })

    expect(result).toHaveLength(604)
    expect(ranges).toEqual([[0, 499], [500, 999]])
  })
})
