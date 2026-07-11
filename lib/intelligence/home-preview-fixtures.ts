import {
  HISTORY_MONTHS,
  makeCard,
  makeExpense,
  makeFreshUserSnapshot,
  makeInputs,
  makeRecurringIncome,
  makeSnapshot,
  makeSubscription,
} from './__tests__/fixtures'
import type { HomeDisplayContext } from './home-display-context'
import { buildHomeIntelligence, type HomeOrchestratorOptions } from './home-orchestrator'
import type { HomeIntelligenceModel } from './home-model'
import type { FinancialSnapshot } from './types'

/**
 * Fixtures determinísticos de la Fase D (guía v1.1 §21): todos los estados
 * del Home inteligente agrupados en las tres composiciones canónicas.
 * Cada estado produce su HomeIntelligenceModel a través del orquestador real.
 */

export type HomePreviewGroup = 'canonica' | 'ambiental' | 'accion' | 'matriz'

export type HomePreviewState = {
  id: string
  title: string
  group: HomePreviewGroup
  /** Caso(s) de la guía que demuestra. */
  cases: number[]
  description: string
  snapshot: FinancialSnapshot
  context: HomeDisplayContext
  options?: HomeOrchestratorOptions
  /** Simula modelo cacheado ante error parcial de API. */
  cachedError?: boolean
}

const defaultContext: HomeDisplayContext = {
  heroBalanceMode: 'default_currency',
  viewCurrency: 'ARS',
  valuationRate: null,
  amountsVisible: true,
}

const GENERATED_AT = '2026-07-15T12:00:00.000Z'

function cardDue(amount: number) {
  return makeCard({
    pendingStatements: [
      { periodMonth: '2026-06', amount, dueDate: '2026-07-18', status: 'cerrado' as const },
    ],
  })
}

function uncoveredCardSnapshot() {
  // Disponible Real = Saldo Vivo − deuda de tarjeta: coherente con la card.
  return makeSnapshot({
    saldoVivo: { ARS: 200_000, USD: 0 },
    disponibleReal: { ARS: -100_000, USD: 0 },
    cards: [cardDue(300_000)],
  })
}

function subscriptionIncreaseSnapshot() {
  return makeSnapshot({
    expenses: [
      ...makeInputs().expenses,
      ...HISTORY_MONTHS.map((month) =>
        makeExpense({
          date: `${month}-08`,
          amount: 15_000,
          category: 'Suscripciones',
          description: 'Streaming',
        }),
      ),
      makeExpense({
        date: '2026-07-08',
        amount: 21_000,
        category: 'Suscripciones',
        description: 'Streaming',
      }),
    ],
    subscriptions: [makeSubscription({ description: 'Streaming', amount: 21_000, dayOfMonth: 8 })],
  })
}

function unusualMovementSnapshot() {
  return makeSnapshot({
    expenses: [
      ...makeInputs().expenses,
      makeExpense({ date: '2026-07-15', amount: 300_000, description: 'Supermercado Coto' }),
    ],
  })
}

function paceSnapshot() {
  return makeSnapshot({
    disponibleReal: { ARS: 200_000, USD: 0 },
    expenses: [
      ...makeInputs().expenses,
      ...[3, 6, 9, 12, 15].map((day) =>
        makeExpense({
          date: `2026-07-${String(day).padStart(2, '0')}`,
          amount: 84_000,
          description: 'Compra grande',
        }),
      ),
    ],
  })
}

function creditShiftSnapshot() {
  return makeSnapshot({
    expenses: [
      ...makeInputs().expenses,
      ...[2, 4, 6, 8, 10, 12].map((day) =>
        makeExpense({
          date: `2026-07-${String(day).padStart(2, '0')}`,
          amount: 30_000,
          payment_method: 'CREDIT' as const,
          description: 'Consumo crédito',
        }),
      ),
    ],
  })
}

function truncatedSnapshot() {
  const inputs = makeInputs()
  return makeSnapshot({
    sourceLimits: { expenses: inputs.expenses.length, incomes: 200, transfers: 200 },
  })
}

export const HOME_PREVIEW_STATES: HomePreviewState[] = [
  // ── Composiciones canónicas (§11.9) ────────────────────────────────────────
  {
    id: 'canonical-calm',
    title: 'Canónica A — Calma',
    group: 'canonica',
    cases: [6],
    description: 'Cero Action Slot; Disponible Real en positivo acotado; sin adornos de IA.',
    snapshot: makeSnapshot({
      cards: [makeCard({ currentCycleSpend: 172_400, daysUntilClosing: 12 })],
    }),
    context: defaultContext,
  },
  {
    id: 'canonical-contextual-attention',
    title: 'Canónica B — Atención contextual',
    group: 'canonica',
    cases: [1],
    description: 'El módulo propietario (Compromisos) absorbe la señal; sin Action Slot global.',
    snapshot: makeSnapshot({
      saldoVivo: { ARS: 800_000, USD: 0 },
      disponibleReal: { ARS: 500_000, USD: 0 },
      cards: [cardDue(300_000)],
    }),
    context: defaultContext,
  },
  {
    id: 'canonical-action-required',
    title: 'Canónica C — Acción necesaria',
    group: 'canonica',
    cases: [2],
    description: 'Un Action Slot máximo; el módulo causal complementa sin repetir el monto.',
    snapshot: uncoveredCardSnapshot(),
    context: defaultContext,
  },
  // ── Estados ambientales ────────────────────────────────────────────────────
  {
    id: 'ambient-calm',
    title: 'Ambiental — calma proyectada',
    group: 'ambiental',
    cases: [6],
    description: 'Con lo registrado, llegás cubierto: margen diario en la explicación.',
    snapshot: makeSnapshot(),
    context: defaultContext,
  },
  {
    id: 'ambient-watch',
    title: 'Ambiental — watch (ritmo)',
    group: 'ambiental',
    cases: [7],
    description: 'Ritmo observado supera el margen permitido: watch + acción transitoria.',
    snapshot: paceSnapshot(),
    context: defaultContext,
  },
  {
    id: 'ambient-risk',
    title: 'Ambiental — risk sin acción',
    group: 'ambiental',
    cases: [2],
    description: 'Liquidez corta por débitos (sin tarjeta): risk ambiental sin Action Slot.',
    snapshot: makeSnapshot({
      saldoVivo: { ARS: 20_000, USD: 0 },
      disponibleReal: { ARS: 20_000, USD: 0 },
      subscriptions: [makeSubscription({ description: 'Alquiler', amount: 100_000, dayOfMonth: 20 })],
    }),
    context: defaultContext,
  },
  {
    id: 'ambient-debit-today',
    title: 'Ambiental — débito de hoy',
    group: 'ambiental',
    cases: [3],
    description: 'El débito del día ya está reservado y se informa sin alarma.',
    snapshot: makeSnapshot({
      subscriptions: [makeSubscription({ description: 'Internet', amount: 42_000, dayOfMonth: 15 })],
    }),
    context: defaultContext,
  },
  {
    id: 'ambient-credit-shift',
    title: 'Ambiental — mezcla hacia crédito',
    group: 'ambiental',
    cases: [14],
    description: 'Compromisos avisa el corrimiento débito→crédito vs. el histórico.',
    snapshot: creditShiftSnapshot(),
    context: defaultContext,
  },
  {
    id: 'ambient-closing',
    title: 'Ambiental — cierre estimado (flag)',
    group: 'ambiental',
    cases: [9],
    description: 'Caso 9 detrás de flag: copy según rollover_mode.',
    snapshot: makeSnapshot({ today: '2026-07-29' }),
    context: defaultContext,
    options: { closingProjection: { enabled: true, rolloverMode: 'auto' } },
  },
  // ── Acciones transitorias ──────────────────────────────────────────────────
  {
    id: 'action-card-shortfall',
    title: 'Acción — tarjeta no cubierta',
    group: 'accion',
    cases: [2],
    description: 'Faltante material para cubrir Visa: risk con CTA nativo.',
    snapshot: uncoveredCardSnapshot(),
    context: defaultContext,
  },
  {
    id: 'action-income-missing',
    title: 'Acción — ingreso esperado',
    group: 'accion',
    cases: [8],
    description: 'Ingreso recurrente sin registrar: prefill con confirmación.',
    snapshot: makeSnapshot({
      recurringIncomes: [makeRecurringIncome({ dayOfMonth: 10, pendingThisMonth: true })],
    }),
    context: defaultContext,
  },
  {
    id: 'action-subscription-increase',
    title: 'Acción — suscripción que aumentó',
    group: 'accion',
    cases: [5],
    description: 'Streaming subió 40% contra su histórico materializado.',
    snapshot: subscriptionIncreaseSnapshot(),
    context: defaultContext,
  },
  {
    id: 'movement-anomaly',
    title: 'Anotación — movimiento inusual',
    group: 'accion',
    cases: [4],
    description: 'La fila del movimiento absorbe la señal; sin Action Slot.',
    snapshot: unusualMovementSnapshot(),
    context: defaultContext,
  },
  // ── Matriz de calidad, moneda y masking ───────────────────────────────────
  {
    id: 'learning',
    title: 'Matriz — learning',
    group: 'matriz',
    cases: [15],
    description: 'Primer mes: aprende, no afirma calma.',
    snapshot: makeFreshUserSnapshot(),
    context: defaultContext,
  },
  {
    id: 'partial-data',
    title: 'Matriz — datos truncados',
    group: 'matriz',
    cases: [15],
    description: 'Cobertura truncada inhibe estados positivos: copy neutral acotada.',
    snapshot: truncatedSnapshot(),
    context: defaultContext,
  },
  {
    id: 'masked',
    title: 'Matriz — montos ocultos',
    group: 'matriz',
    cases: [2, 12],
    description: 'Ningún monto formateado; los títulos pueden quedar.',
    snapshot: uncoveredCardSnapshot(),
    context: { ...defaultContext, amountsVisible: false },
  },
  {
    id: 'combined-ars',
    title: 'Matriz — combinado ARS',
    group: 'matriz',
    cases: [12],
    description: 'Base combinada con cotización válida y composición explicable.',
    snapshot: makeSnapshot({ saldoVivo: { ARS: 2_612_100, USD: 196 } }),
    context: { ...defaultContext, heroBalanceMode: 'combined_ars', valuationRate: 1200 },
  },
  {
    id: 'combined-usd',
    title: 'Matriz — combinado USD',
    group: 'matriz',
    cases: [12],
    description: 'Misma base en USD.',
    snapshot: makeSnapshot({ saldoVivo: { ARS: 2_612_100, USD: 196 } }),
    context: {
      ...defaultContext,
      heroBalanceMode: 'combined_usd',
      viewCurrency: 'USD',
      valuationRate: 1200,
    },
  },
  {
    id: 'long-amount',
    title: 'Matriz — montos largos',
    group: 'matriz',
    cases: [6],
    description: 'Cientos de millones sin overflow.',
    snapshot: makeSnapshot({
      saldoVivo: { ARS: 128_450_300_000, USD: 0 },
      disponibleReal: { ARS: 98_760_543_210, USD: 0 },
    }),
    context: defaultContext,
  },
  {
    id: 'cached-error',
    title: 'Matriz — error con modelo cacheado',
    group: 'matriz',
    cases: [15],
    description: 'Ante API parcial se usa el último modelo válido, sin card de error.',
    snapshot: makeSnapshot(),
    context: defaultContext,
    cachedError: true,
  },
]

export type HomePreviewResolved = HomePreviewState & { model: HomeIntelligenceModel | null }

export function resolvePreviewState(state: HomePreviewState): HomePreviewResolved {
  return {
    ...state,
    model: buildHomeIntelligence(state.snapshot, state.context, {
      generatedAt: GENERATED_AT,
      ...state.options,
    }),
  }
}
