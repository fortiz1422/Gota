import { describe, expect, it } from 'vitest'
import { buildAnswerPacket } from '../chat-evidence'
import { planChatQuery } from '../chat-planner'
import type { HomeDisplayContext } from '../home-display-context'
import { buildHomeIntelligence } from '../home-orchestrator'
import { simulatePurchase } from '../projection'
import { assembleFinancialSnapshot } from '../snapshot'
import {
  HISTORY_MONTHS,
  makeCard,
  makeExpense,
  makeFreshUserSnapshot,
  makeInputs,
  makeRecurringIncome,
  makeSnapshot,
  makeSubscription,
} from './fixtures'

const displayContext: HomeDisplayContext = {
  heroBalanceMode: 'default_currency',
  viewCurrency: 'ARS',
  valuationRate: null,
  amountsVisible: true,
}

/** Todos los strings visibles del modelo, para chequeos de masking/duplicación. */
function renderedStrings(model: NonNullable<ReturnType<typeof buildHomeIntelligence>>): string[] {
  const out: string[] = []
  for (const modifier of [
    model.ambient.saldoVivo,
    model.ambient.disponibleReal,
    model.ambient.commitments,
  ]) {
    if (modifier) out.push(modifier.label, modifier.detail ?? '')
  }
  for (const annotation of model.ambient.movementAnnotations) out.push(annotation.label)
  if (model.actionSlot) out.push(model.actionSlot.title, model.actionSlot.subtitle)
  return out
}

// ─── Caso 1: tarjeta cubierta ────────────────────────────────────────────────

describe('caso 1 — tarjeta cubierta', () => {
  const snapshot = makeSnapshot({
    saldoVivo: { ARS: 800_000, USD: 0 },
    cards: [
      makeCard({
        pendingStatements: [
          { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-18', status: 'cerrado' },
        ],
      }),
    ],
  })

  it('edita Compromisos en watch, sin Action Slot', () => {
    const model = buildHomeIntelligence(snapshot, displayContext)!

    expect(model.actionSlot).toBeNull()
    expect(model.ambient.commitments?.status).toBe('watch')
    expect(model.ambient.commitments?.label).toMatch(/Visa Galicia.*cubiert/i)
  })

  it('expone evidencia con monto a pagar y saldo post-pago', () => {
    const model = buildHomeIntelligence(snapshot, displayContext)!
    const explanation = model.explanations[model.ambient.commitments!.explanationId!]

    expect(explanation.evidence.map((item) => item.id)).toEqual(
      expect.arrayContaining([expect.stringContaining('card')]),
    )
    expect(explanation.evidence.some((item) => item.value.includes('300.000'))).toBe(true)
  })
})

// ─── Caso 2: tarjeta no cubierta ─────────────────────────────────────────────

describe('caso 2 — tarjeta no cubierta', () => {
  const snapshot = makeSnapshot({
    saldoVivo: { ARS: 200_000, USD: 0 },
    cards: [
      makeCard({
        pendingStatements: [
          { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-18', status: 'cerrado' },
        ],
      }),
    ],
  })

  it('escala al Action Slot con el faltante y CTA nativo', () => {
    const model = buildHomeIntelligence(snapshot, displayContext)!

    expect(model.actionSlot?.kind).toBe('card_shortfall')
    expect(model.actionSlot?.status).toBe('risk')
    expect(model.actionSlot?.subtitle).toMatch(/100\.000/)
    expect(model.actionSlot?.action.type).toBe('review_card')
  })

  it('Compromisos queda en risk sin repetir el monto del Action Slot', () => {
    const model = buildHomeIntelligence(snapshot, displayContext)!

    expect(model.ambient.commitments?.status).toBe('risk')
    expect(model.ambient.commitments?.label).not.toMatch(/100\.000/)
  })

  it('el faltante aparece una sola vez en todo el modelo', () => {
    const model = buildHomeIntelligence(snapshot, displayContext)!
    const occurrences = renderedStrings(model).join(' ').match(/100\.000/g) ?? []

    expect(occurrences).toHaveLength(1)
  })
})

// ─── Caso 3: débito de hoy ───────────────────────────────────────────────────

describe('caso 3 — débito que se debita hoy', () => {
  it('Disponible Real avisa el débito de hoy como reservado', () => {
    const snapshot = makeSnapshot({
      subscriptions: [makeSubscription({ description: 'Internet', amount: 42_000, dayOfMonth: 15 })],
    })
    const model = buildHomeIntelligence(snapshot, displayContext)!

    expect(model.ambient.disponibleReal?.label).toMatch(/Hoy se debita Internet/)
    expect(model.ambient.disponibleReal?.label).toMatch(/42\.000/)
    expect(model.actionSlot).toBeNull()
  })
})

// ─── Caso 4: movimiento fuera de lo habitual ────────────────────────────────

describe('caso 4 — movimiento fuera de lo habitual', () => {
  it('anota la fila del movimiento sin escalar al Action Slot', () => {
    const unusual = makeExpense({ date: '2026-07-15', amount: 300_000 })
    const snapshot = makeSnapshot({ expenses: [...makeInputs().expenses, unusual] })
    const model = buildHomeIntelligence(snapshot, displayContext)!

    const annotation = model.ambient.movementAnnotations.find(
      (item) => item.movementId === unusual.id,
    )
    expect(annotation?.kind).toBe('unusual_amount')
    expect(annotation?.label).toBe('Monto fuera de lo habitual')
    expect(annotation?.action?.type).toBe('review_movement')
    expect(model.actionSlot).toBeNull()
  })

  it('cada fila admite como máximo una anotación', () => {
    const unusual = makeExpense({ date: '2026-07-15', amount: 300_000 })
    const snapshot = makeSnapshot({ expenses: [...makeInputs().expenses, unusual] })
    const model = buildHomeIntelligence(snapshot, displayContext)!

    const ids = model.ambient.movementAnnotations.map((item) => item.movementId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ─── Caso 5: suscripción que aumentó ────────────────────────────────────────

function subscriptionIncreaseInputs() {
  const streamingHistory = HISTORY_MONTHS.map((month) =>
    makeExpense({
      date: `${month}-08`,
      amount: 15_000,
      category: 'Suscripciones',
      description: 'Streaming',
    }),
  )
  const streamingNow = makeExpense({
    date: '2026-07-08',
    amount: 21_000,
    category: 'Suscripciones',
    description: 'Streaming',
  })
  return {
    expenses: [...makeInputs().expenses, ...streamingHistory, streamingNow],
    subscriptions: [
      makeSubscription({ description: 'Streaming', amount: 21_000, dayOfMonth: 8 }),
    ],
  }
}

describe('caso 5 — suscripción que aumentó', () => {
  it('escala al Action Slot en watch con el porcentaje de aumento', () => {
    const model = buildHomeIntelligence(makeSnapshot(subscriptionIncreaseInputs()), displayContext)!

    expect(model.actionSlot?.kind).toBe('subscription_increase')
    expect(model.actionSlot?.status).toBe('watch')
    expect(model.actionSlot?.title).toMatch(/Streaming aumentó 40%/)
    expect(model.actionSlot?.action.type).toBe('review_subscription')
  })
})

// ─── Caso 6: margen diario ───────────────────────────────────────────────────

describe('caso 6 — margen diario en calma', () => {
  it('Disponible Real muestra calma proyectada acotada a lo registrado', () => {
    const model = buildHomeIntelligence(makeSnapshot(), displayContext)!

    expect(model.ambient.disponibleReal?.status).toBe('positive')
    expect(model.ambient.disponibleReal?.label).toMatch(/con lo registrado/i)
    expect(model.actionSlot).toBeNull()
  })

  it('la explicación expone el margen diario permitido', () => {
    const model = buildHomeIntelligence(makeSnapshot(), displayContext)!
    const explanation = model.explanations[model.ambient.disponibleReal!.explanationId!]

    expect(explanation.evidence.some((item) => item.id === 'projection:safe_to_spend')).toBe(true)
  })
})

// ─── Caso 7: ritmo observado insostenible ───────────────────────────────────

describe('caso 7 — ritmo insostenible', () => {
  it('escala al Action Slot con la proyección de déficit', () => {
    const heavySpending = [3, 5, 7, 9, 11, 13, 15].map((day) =>
      makeExpense({ date: `2026-07-${String(day).padStart(2, '0')}`, amount: 60_000 }),
    )
    const snapshot = makeSnapshot({
      disponibleReal: { ARS: 200_000, USD: 0 },
      expenses: [...makeInputs().expenses, ...heavySpending],
    })
    const model = buildHomeIntelligence(snapshot, displayContext)!

    expect(model.actionSlot?.kind).toBe('pace_unsustainable')
    expect(model.actionSlot?.title).toBe('Ritmo alto este mes')
    expect(model.actionSlot?.subtitle).toMatch(/^Proyección: .* abajo$/)
    expect(model.ambient.disponibleReal?.status).toBe('watch')
    // El módulo no repite la proyección del Action Slot.
    expect(model.ambient.disponibleReal?.label).not.toMatch(/\d/)
  })
})

// ─── Caso 8: ingreso esperado no confirmado ─────────────────────────────────

describe('caso 8 — ingreso esperado no confirmado', () => {
  const inputs = {
    recurringIncomes: [
      makeRecurringIncome({ id: 'rec-9', dayOfMonth: 10, pendingThisMonth: true }),
    ],
  }

  it('usa el Action Slot con prefill de ingreso', () => {
    const model = buildHomeIntelligence(makeSnapshot(inputs), displayContext)!

    expect(model.actionSlot?.kind).toBe('income_missing')
    expect(model.actionSlot?.action).toMatchObject({ type: 'prefill_income', recurringIncomeId: 'rec-9' })
  })

  it('tiene prioridad sobre una suscripción que aumentó', () => {
    const model = buildHomeIntelligence(
      makeSnapshot({ ...subscriptionIncreaseInputs(), ...inputs }),
      displayContext,
    )!

    expect(model.actionSlot?.kind).toBe('income_missing')
  })
})

// ─── Caso 9: cierre y rollover (future_flagged) ─────────────────────────────

describe('caso 9 — cierre estimado detrás de flag', () => {
  it('sin flag no toca Saldo Vivo', () => {
    const model = buildHomeIntelligence(makeSnapshot(), displayContext)!
    expect(model.ambient.saldoVivo).toBeNull()
  })

  it('con flag y fin de mes cerca, la copy depende del rollover_mode', () => {
    const snapshot = makeSnapshot({ today: '2026-07-29' })
    const auto = buildHomeIntelligence(snapshot, displayContext, {
      closingProjection: { enabled: true, rolloverMode: 'auto' },
    })!
    const off = buildHomeIntelligence(snapshot, displayContext, {
      closingProjection: { enabled: true, rolloverMode: 'off' },
    })!

    expect(auto.ambient.saldoVivo?.label).toMatch(/se trasladar/i)
    expect(off.ambient.saldoVivo?.label).toMatch(/desactivado/i)
  })
})

// ─── Casos 10 y 11: simulaciones (superficie asistente) ─────────────────────

describe('casos 10/11 — simulaciones viven en el asistente', () => {
  it('el Home nunca renderiza simulaciones como Action Slot', () => {
    const model = buildHomeIntelligence(makeSnapshot(), displayContext)!
    expect(model.actionSlot).toBeNull()
  })

  it('el motor determinístico de cuotas sigue disponible con veredicto', () => {
    const simulation = simulatePurchase(makeSnapshot(), { amount: 1_800_000, installments: 6 })
    expect(simulation.installmentPlan?.verdict).toBe('tight')
  })
})

// ─── Caso 12: moneda combinada ──────────────────────────────────────────────

describe('caso 12 — moneda combinada', () => {
  it('con cotización válida expone la base y su composición', () => {
    const model = buildHomeIntelligence(makeSnapshot(), {
      ...displayContext,
      heroBalanceMode: 'combined_ars',
      valuationRate: 1200,
    })!

    expect(model.moneyBasis.mode).toBe('combined_ars')
    const basis = model.explanations['currency:basis']
    expect(basis).toBeDefined()
    expect(basis.evidence.some((item) => item.value.includes('1.200'))).toBe(true)
  })

  it('sin cotización no convierte silenciosamente', () => {
    const model = buildHomeIntelligence(makeSnapshot(), {
      ...displayContext,
      heroBalanceMode: 'combined_ars',
      valuationRate: null,
    })!

    expect(model.moneyBasis.mode).toBe('default_currency')
    expect(model.explanations['currency:basis']).toBeUndefined()
  })
})

// ─── Caso 13: categoría (superficie Análisis/asistente) ─────────────────────

describe('caso 13 — categoría con cambio real vive en Análisis', () => {
  it('el histórico por categoría excluye extraordinarios en el asistente', () => {
    const extraordinary = makeExpense({ date: '2026-06-20', amount: 500_000, is_extraordinary: true })
    const packet = buildAnswerPacket(
      makeSnapshot({ expenses: [...makeInputs().expenses, extraordinary] }),
      planChatQuery('¿Cuál fue mi promedio histórico de gasto en supermercado?'),
    )
    const average = packet.facts.find((fact) => fact.label === 'Promedio histórico Supermercado')
    expect(average?.value).toContain('$ 200.000/mes')
  })
})

// ─── Caso 14: cambio hacia crédito ──────────────────────────────────────────

describe('caso 14 — cambio de mezcla hacia crédito', () => {
  it('Compromisos lo muestra como ambient watch con ambos ratios', () => {
    const creditNow = [2, 4, 6, 8, 10, 12].map((day) =>
      makeExpense({
        date: `2026-07-${String(day).padStart(2, '0')}`,
        amount: 30_000,
        payment_method: 'CREDIT',
      }),
    )
    const snapshot = makeSnapshot({ expenses: [...makeInputs().expenses, ...creditNow] })
    const model = buildHomeIntelligence(snapshot, displayContext)!

    expect(model.ambient.commitments?.status).toBe('watch')
    expect(model.ambient.commitments?.label).toMatch(/crédito/)
    expect(model.ambient.commitments?.label).toMatch(/%/)
  })
})

// ─── Caso 15: abstención ─────────────────────────────────────────────────────

describe('caso 15 — abstención', () => {
  it('usuario nuevo: aprende, no afirma que no hay nada urgente', () => {
    const model = buildHomeIntelligence(makeFreshUserSnapshot(), displayContext)!

    expect(model.actionSlot).toBeNull()
    expect(model.ambient.disponibleReal?.status).toBe('neutral')
    expect(model.ambient.disponibleReal?.label).toMatch(/aprendiendo/i)
    const all = renderedStrings(model).join(' ')
    expect(all).not.toMatch(/nada urgente|todo en orden/i)
  })

  it('cobertura truncada inhibe estados positivos', () => {
    const inputs = makeInputs()
    const snapshot = assembleFinancialSnapshot({
      ...inputs,
      sourceLimits: { expenses: inputs.expenses.length, incomes: 200, transfers: 200 },
    })
    const model = buildHomeIntelligence(snapshot, displayContext)!

    expect(model.ambient.disponibleReal?.status).not.toBe('positive')
    expect(model.dataQuality).toBe('partial')
  })
})

// ─── Reglas transversales ────────────────────────────────────────────────────

describe('reglas transversales del orquestador', () => {
  it('sin cuenta activa devuelve null', () => {
    expect(buildHomeIntelligence(makeSnapshot({ accountBalances: [] }), displayContext)).toBeNull()
  })

  it('mes pasado: sin Action Slot ni copy de hoy', () => {
    const snapshot = makeSnapshot({
      today: '2026-08-10',
      subscriptions: [makeSubscription({ dayOfMonth: 15 })],
      recurringIncomes: [makeRecurringIncome({ pendingThisMonth: true, dayOfMonth: 10 })],
    })
    const model = buildHomeIntelligence(snapshot, displayContext)!

    expect(model.actionSlot).toBeNull()
    expect(model.ambient.disponibleReal).toBeNull()
  })

  it('con montos ocultos ningún string del modelo trae montos formateados', () => {
    const snapshot = makeSnapshot({
      saldoVivo: { ARS: 200_000, USD: 0 },
      cards: [
        makeCard({
          pendingStatements: [
            { periodMonth: '2026-06', amount: 300_000, dueDate: '2026-07-18', status: 'cerrado' },
          ],
        }),
      ],
    })
    const model = buildHomeIntelligence(snapshot, {
      ...displayContext,
      amountsVisible: false,
    })!

    const all = [
      ...renderedStrings(model),
      ...Object.values(model.explanations).flatMap((explanation) => [
        explanation.summary,
        ...explanation.evidence.map((item) => item.value),
      ]),
    ].join(' ')
    expect(all).not.toMatch(/(?:USD|\$)\s?[\d.,]+/)
  })

  it('un snooze vigente suprime esa acción', () => {
    const snapshot = makeSnapshot({
      recurringIncomes: [makeRecurringIncome({ id: 'rec-9', dayOfMonth: 10, pendingThisMonth: true })],
    })
    const model = buildHomeIntelligence(snapshot, displayContext, {
      snoozedDedupeKeys: ['income_missing:rec-9:2026-07'],
    })!

    expect(model.actionSlot).toBeNull()
  })
})
