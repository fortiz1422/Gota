import { describe, expect, it } from 'vitest'
import { buildAnswerPacket } from '../chat-evidence'
import { planChatQuery } from '../chat-planner'
import {
  makeBudgetSnapshot,
  makeCard,
  makeExpense,
  HISTORY_MONTHS,
  makeFreshUserSnapshot,
  makeInputs,
  makeSnapshot,
} from './fixtures'

function packetFor(question: string, snapshot = makeSnapshot()) {
  return buildAnswerPacket(snapshot, planChatQuery(question))
}

function labels(packet: ReturnType<typeof buildAnswerPacket>): string[] {
  return packet.facts.map((fact) => fact.label)
}

describe('balance_status — "¿Cuánto me queda realmente disponible?"', () => {
  it('incluye Saldo Vivo, Disponible Real y cuentas', () => {
    const packet = packetFor('¿Cuánto me queda realmente disponible?')
    expect(labels(packet)).toContain('Saldo Vivo ARS')
    expect(labels(packet)).toContain('Disponible Real ARS')
    expect(labels(packet)).toContain('Cuenta Banco')
  })

  it('resta metas comprometidas como "Libre después de metas"', () => {
    const packet = packetFor(
      '¿Cuánto me queda realmente disponible?',
      makeSnapshot({ goals: { count: 1, committed: { ARS: 100_000, USD: 0 } } }),
    )
    const libre = packet.facts.find((fact) => fact.label === 'Libre después de metas')
    expect(libre?.value).toBe('$ 500.000')
  })
})

describe('budget_question — "¿Dónde estoy pasado de presupuesto?"', () => {
  it('sin plan activo agrega caveat y no inventa números', () => {
    const packet = packetFor('¿Dónde estoy pasado de presupuesto?')
    expect(packet.caveats.some((caveat) => caveat.includes('No hay presupuesto activo'))).toBe(true)
    expect(labels(packet).some((label) => label.startsWith('Presupuesto '))).toBe(false)
  })

  it('con plan lista uso por categoría con avance del mes', () => {
    const packet = packetFor(
      '¿Dónde estoy pasado de presupuesto?',
      makeSnapshot({
        budget: makeBudgetSnapshot([
          { category: 'Supermercado', amount: 200_000, spentAmount: 150_000 },
        ]),
      }),
    )
    const item = packet.facts.find((fact) => fact.label === 'Presupuesto Supermercado')
    expect(item?.value).toContain('75% usado')
    expect(item?.value).toContain('48% del mes')
  })

  it('si pregunta por una categoría combina presupuesto actual con promedio histórico', () => {
    const educationHistory = HISTORY_MONTHS.flatMap((month) => [
      makeExpense({
        date: `${month}-05`,
        amount: 80_000,
        category: 'Educación',
        description: 'Colegio',
      }),
    ])
    const packet = packetFor(
      '¿Tengo que revisar mi presupuesto de educación?',
      makeSnapshot({
        expenses: [...makeInputs().expenses, ...educationHistory],
        budget: makeBudgetSnapshot([
          { category: 'Educación', amount: 60_000, spentAmount: 80_000 },
        ]),
      }),
    )

    expect(packet.intent).toBe('budget_question')
    expect(labels(packet)).toContain('Presupuesto Educación')
    expect(labels(packet)).toContain('Promedio histórico Educación')
  })
})

describe('card_commitments — "¿Qué compromisos fuertes tengo antes de fin de mes?"', () => {
  it('lista resúmenes pendientes con vencimiento y total', () => {
    const packet = packetFor(
      '¿Qué compromisos fuertes tengo antes de fin de mes?',
      makeSnapshot({
        cards: [
          makeCard({
            pendingStatements: [
              { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-18', status: 'cerrado' },
            ],
          }),
        ],
      }),
    )
    expect(labels(packet)).toContain('Total resúmenes pendientes')
    const statement = packet.facts.find((fact) => fact.label.startsWith('Resumen Visa Galicia'))
    expect(statement?.value).toContain('$ 300.000')
    expect(statement?.value).toContain('18 jul')
  })

  it('sin tarjetas lo dice explícitamente', () => {
    const packet = packetFor('¿Qué compromisos tengo?')
    expect(packet.facts.some((fact) => fact.value.includes('Sin tarjetas'))).toBe(true)
  })
})

describe('movement_lookup — "Mostrame movimientos grandes recientes."', () => {
  it('ordena por monto descendente y respeta el límite', () => {
    const packet = packetFor(
      'Mostrame movimientos grandes recientes.',
      makeSnapshot({
        expenses: [
          ...makeInputs().expenses,
          makeExpense({
            date: '2026-07-14',
            amount: 200_000,
            category: 'Supermercado',
            description: 'Compra grande',
          }),
        ],
      }),
    )
    expect(packet.movements.length).toBeGreaterThan(0)
    expect(packet.movements.length).toBeLessThanOrEqual(8)
    expect(packet.movements[0].description).toBe('Compra grande')
    const amounts = packet.movements.map((movement) => movement.amount)
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts)
  })

  it('filtra por términos de la pregunta', () => {
    const packet = packetFor('cuando compre en rappi?', makeSnapshot())
    expect(packet.movements).toEqual([])
    expect(packet.caveats.some((caveat) => caveat.includes('No encontré movimientos'))).toBe(true)
  })

  it('los movimientos USD mantienen su moneda y no se mezclan', () => {
    const packet = packetFor(
      'Mostrame movimientos grandes recientes.',
      makeSnapshot({
        expenses: [
          ...makeInputs().expenses,
          makeExpense({
            date: '2026-07-14',
            amount: 900,
            currency: 'USD',
            category: 'Supermercado',
            description: 'Compra en USD',
          }),
        ],
      }),
    )
    const usd = packet.movements.find((movement) => movement.description === 'Compra en USD')
    expect(usd?.currency).toBe('USD')
    expect(packet.caveats.some((caveat) => caveat.includes('otra moneda'))).toBe(true)
  })
})

describe('trend_comparison — "¿Qué cambió vs meses anteriores a esta altura?"', () => {
  it('con histórico incluye gasto actual, referencia y delta', () => {
    const packet = packetFor('¿Qué cambió vs meses anteriores a esta altura?')
    expect(labels(packet)).toContain('Gasto al día 15')
    expect(labels(packet).some((label) => label.startsWith('Referencia'))).toBe(true)
    expect(labels(packet)).toContain('Diferencia vs referencia')
  })

  it('si pregunta por una categoría, agrega comparativa específica al mismo día', () => {
    const packet = packetFor('Supermercado fue 800k a esta altura en meses anteriores?')

    expect(packet.intent).toBe('trend_comparison')
    expect(labels(packet)).toContain('Promedio a esta altura Supermercado')
    expect(labels(packet)).toContain('Este mes a la fecha Supermercado')
    expect(labels(packet)).toContain('Meses comparados a esta altura Supermercado')
    expect(labels(packet)).toContain('Promedio mensual completo Supermercado')

    const sameDayAverage = packet.facts.find(
      (fact) => fact.label === 'Promedio a esta altura Supermercado',
    )
    expect(sameDayAverage?.value).toContain('$ 120.000')
    expect(sameDayAverage?.value).toContain('día 15')
    expect(sameDayAverage?.value).toContain('5 meses')

    const current = packet.facts.find((fact) => fact.label === 'Este mes a la fecha Supermercado')
    expect(current?.value).toContain('$ 120.000')
    expect(current?.value).toContain('0% vs promedio a esta altura')

    const fullMonth = packet.facts.find(
      (fact) => fact.label === 'Promedio mensual completo Supermercado',
    )
    expect(fullMonth?.value).toContain('$ 200.000/mes')
  })

  it('sin histórico agrega caveat en lugar de inventar referencia', () => {
    const packet = packetFor(
      '¿Qué cambió vs meses anteriores a esta altura?',
      makeFreshUserSnapshot(),
    )
    expect(labels(packet).some((label) => label.startsWith('Referencia'))).toBe(false)
    expect(packet.caveats.some((caveat) => caveat.includes('primer mes'))).toBe(true)
  })
})

describe('category_breakdown — "¿En qué estoy gastando más este mes?"', () => {
  it('lista top categorías del mes y del mes pasado', () => {
    const packet = packetFor('¿En qué estoy gastando más este mes?')
    expect(labels(packet)).toContain('Supermercado (este mes)')
    expect(labels(packet)).toContain('Supermercado (mes pasado)')
    const current = packet.facts.find((fact) => fact.label === 'Supermercado (este mes)')
    expect(current?.value).toContain('$ 120.000')
    expect(current?.value).toContain('3 movimientos')
  })
})

describe('category_history — promedio histórico por categoría', () => {
  it('responde con promedio, rango, meses usados y mes actual a la fecha de la categoría consultada', () => {
    const packet = packetFor('¿Cuál fue mi promedio histórico de gasto en supermercado?')

    expect(packet.intent).toBe('category_history')
    expect(labels(packet)).toContain('Promedio histórico Supermercado')
    expect(labels(packet)).toContain('Rango histórico Supermercado')
    expect(labels(packet)).toContain('Este mes a la fecha Supermercado')
    expect(labels(packet)).toContain('Meses usados Supermercado')

    const average = packet.facts.find((fact) => fact.label === 'Promedio histórico Supermercado')
    expect(average?.value).toContain('$ 200.000/mes')
    expect(average?.value).toContain('5 meses con gasto')

    const current = packet.facts.find((fact) => fact.label === 'Este mes a la fecha Supermercado')
    expect(current?.value).toContain('$ 120.000')
    expect(current?.value).toContain('-40% vs promedio mensual')
  })

  it('matchea alias parciales como super contra Supermercado', () => {
    const packet = packetFor('¿Cuánto gasto normalmente en super?')

    expect(packet.intent).toBe('category_history')
    expect(labels(packet)).toContain('Promedio histórico Supermercado')
  })

  it('explicita cuando el promedio usa solo algunos meses con gasto', () => {
    const sparseHistory = [
      makeExpense({ date: '2026-03-05', amount: 30_000, category: 'Farmacia' }),
      makeExpense({ date: '2026-06-05', amount: 90_000, category: 'Farmacia' }),
    ]
    const packet = packetFor(
      '¿Cuál fue mi promedio histórico de gasto en farmacia?',
      makeSnapshot({ expenses: [...makeInputs().expenses, ...sparseHistory] }),
    )

    const average = packet.facts.find((fact) => fact.label === 'Promedio histórico Farmacia')
    const months = packet.facts.find((fact) => fact.label === 'Meses usados Farmacia')
    expect(average?.value).toContain('$ 60.000/mes')
    expect(average?.value).toContain('2 meses con gasto')
    expect(months?.value).toContain('2026-03, 2026-06')
  })

  it('si la categoría no existe, lo dice sin inventar promedio', () => {
    const packet = packetFor('¿Cuál fue mi promedio histórico de gasto en farmacia?')

    expect(packet.intent).toBe('category_history')
    expect(labels(packet).some((label) => label.startsWith('Promedio histórico'))).toBe(false)
    expect(packet.caveats.some((caveat) => caveat.includes('No encontré histórico'))).toBe(true)
  })
})

describe('what_should_i_do — "¿Qué debería mirar hoy?"', () => {
  it('incluye los insight candidates cuando hay señales', () => {
    const packet = packetFor(
      '¿Qué debería mirar hoy?',
      makeSnapshot({
        cards: [
          makeCard({
            pendingStatements: [
              { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-18', status: 'cerrado' },
            ],
          }),
        ],
      }),
    )
    expect(packet.insights.length).toBeGreaterThan(0)
    expect(packet.insights[0].kind).toBe('upcoming_card_due')
  })

  it('sin señales lo dice explícitamente', () => {
    const packet = packetFor('¿Qué debería mirar hoy?')
    expect(packet.insights).toEqual([])
    expect(packet.facts.some((fact) => fact.label === 'Señales del mes')).toBe(true)
  })
})

describe('followUps', () => {
  it('cada intent trae follow-ups determinísticos', () => {
    const packet = packetFor('¿Cuánto me queda realmente disponible?')
    expect(packet.followUps.length).toBeGreaterThan(0)
  })
})
