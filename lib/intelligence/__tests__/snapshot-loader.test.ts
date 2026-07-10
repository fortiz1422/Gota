import { describe, expect, it } from 'vitest'
import { computeSameDaySpend } from '../features'
import { assembleFinancialSnapshot } from '../snapshot'
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
