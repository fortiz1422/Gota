import type {
  SignalCenterModel,
  SignalCoverage,
  SignalCoverageState,
  SignalDomain,
  SignalOccurrence,
} from './signal-center'
import type { DataQuality, InsightKind, InsightSeverity } from './types'

export type SignalsPreviewState = {
  id: string
  title: string
  description: string
  model: SignalCenterModel
  amountsVisible: boolean
  isHistoricalContext?: boolean
}

const GENERATED_AT = '2026-07-15T12:00:00.000Z'
const VALID_UNTIL = '2026-07-18'
const FAMILIES: SignalDomain[] = [
  'liquidity',
  'cards',
  'budget',
  'pace',
  'unusual',
  'installments',
  'wants',
  'goals',
  'income',
  'subscriptions',
]

const KIND_BY_DOMAIN: Record<SignalDomain, InsightKind> = {
  liquidity: 'liquidity_watch',
  cards: 'upcoming_card_due',
  budget: 'budget_acceleration',
  pace: 'same_day_spend_delta',
  unusual: 'recent_unusual_movement',
  installments: 'installment_load',
  wants: 'wants_creep',
  goals: 'goal_pace',
  income: 'income_missing',
  subscriptions: 'subscription_load',
}

function coverage(
  overrides: Partial<Record<SignalDomain, SignalCoverageState>> = {},
): SignalCoverage[] {
  return FAMILIES.map((family) => ({
    family,
    state: overrides[family] ?? 'active',
  }))
}

function identity(index: number, prefix: 'sig' | 'sigv'): string {
  return `${prefix}_${index.toString(16).padStart(64, String(index % 10))}`
}

function signal({
  index,
  domain,
  severity,
  title,
  summary,
  message,
  evidence,
  caveats = [],
  dataQuality = 'ok',
  action = null,
  askQuestion = null,
}: {
  index: number
  domain: SignalDomain
  severity: InsightSeverity
  title: string
  summary: string
  message: string
  evidence: SignalOccurrence['evidence']
  caveats?: string[]
  dataQuality?: DataQuality
  action?: SignalOccurrence['action']
  askQuestion?: string | null
}): SignalOccurrence {
  const occurrenceKey = identity(index, 'sig')
  return {
    id: occurrenceKey,
    occurrenceKey,
    version: identity(index, 'sigv'),
    kind: KIND_BY_DOMAIN[domain],
    domain,
    severity,
    priority: 500 - index,
    title,
    summary,
    message,
    evidence,
    caveats,
    dataQuality,
    validUntil: VALID_UNTIL,
    action,
    askQuestion,
    source: 'candidate',
  }
}

function model(
  signals: SignalOccurrence[],
  options: {
    dataQuality?: DataQuality
    coverage?: SignalCoverage[]
  } = {},
): SignalCenterModel {
  return {
    generatedAt: GENERATED_AT,
    month: '2026-07',
    currency: 'ARS',
    dataQuality: options.dataQuality ?? 'ok',
    signals,
    coverage: options.coverage ?? coverage(),
  }
}

const watchPace = signal({
  index: 1,
  domain: 'pace',
  severity: 'watch',
  title: 'Tu ritmo de gasto subió',
  summary: 'Vas 28% arriba de tu ritmo habitual a esta altura.',
  message: 'Llevás $ 420.000 al día 15. En meses comparables llevabas $ 328.000.',
  evidence: [
    { label: 'Este mes al día 15', value: '$ 420.000', asOf: '2026-07-15' },
    { label: 'Ritmo habitual', value: '$ 328.000' },
    { label: 'Diferencia', value: '+28%' },
  ],
  caveats: ['La comparación excluye movimientos marcados como extraordinarios.'],
  askQuestion: '¿Qué explica que lleve $ 92.000 más que mi ritmo habitual?',
})

const liquidityRisk = signal({
  index: 2,
  domain: 'liquidity',
  severity: 'risk',
  title: 'La tarjeta no llega a quedar cubierta',
  summary: 'Con lo registrado, faltan $ 100.000 para el próximo vencimiento.',
  message: 'Tu saldo disponible es $ 200.000 y la Visa vence por $ 300.000 el 18 de julio.',
  evidence: [
    { label: 'Saldo disponible', value: '$ 200.000', asOf: '2026-07-15' },
    { label: 'Próximo vencimiento', value: '$ 300.000', asOf: '2026-07-18' },
    { label: 'Faltante estimado', value: '$ 100.000' },
  ],
  caveats: ['No incluye ingresos que todavía no registraste.'],
  action: { type: 'navigate', label: 'Ver tarjeta', href: '/tarjetas' },
  askQuestion: '¿Cómo puedo cubrir los $ 100.000 que faltan?',
})

const unusual = signal({
  index: 3,
  domain: 'unusual',
  severity: 'info',
  title: 'Apareció un gasto fuera de lo habitual',
  summary: 'Una compra de supermercado fue mayor que tus registros recientes.',
  message: 'El gasto de $ 145.000 supera el rango usual de esta categoría.',
  evidence: [
    { label: 'Movimiento reciente', value: '$ 145.000', asOf: '2026-07-14' },
    { label: 'Mediana reciente', value: '$ 54.000' },
  ],
  askQuestion: '¿Este gasto de $ 145.000 cambia mi proyección del mes?',
})

const subscription = signal({
  index: 4,
  domain: 'subscriptions',
  severity: 'positive',
  title: 'Tus débitos recurrentes siguen estables',
  summary: 'No detectamos aumentos relevantes entre las suscripciones registradas.',
  message: 'Los importes observados se mantienen dentro de su variación habitual.',
  evidence: [
    { label: 'Suscripciones observadas', value: '4' },
    { label: 'Cambios relevantes', value: 'Ninguno' },
  ],
})

const longEvidence = signal({
  index: 5,
  domain: 'installments',
  severity: 'watch',
  title: 'Las cuotas ocupan una parte importante de tus próximos resúmenes',
  summary: 'Hay compromisos distribuidos entre varias tarjetas y fechas de cierre.',
  message: 'La carga de cuotas merece atención porque se combina con consumos nuevos del período.',
  evidence: [
    { label: 'Visa · cuotas pendientes', value: '$ 184.500', asOf: '2026-07-15' },
    { label: 'Mastercard · cuotas pendientes', value: '$ 96.300', asOf: '2026-07-15' },
    { label: 'Consumos nuevos', value: '$ 72.800', asOf: '2026-07-15' },
    { label: 'Total comprometido', value: '$ 353.600' },
    { label: 'Próximo cierre', value: '22 jul' },
    { label: 'Cuotas con más meses restantes', value: 'Notebook · 8 de 12' },
  ],
  caveats: [
    'Los consumos posteriores al último cierre pueden cambiar el próximo resumen.',
    'Las cuotas se muestran según lo registrado; una refinanciación todavía no informada no está incluida.',
  ],
  action: { type: 'navigate', label: 'Revisar cuotas', href: '/tarjetas' },
  askQuestion: '¿Cómo se distribuyen los $ 353.600 entre mis próximas tarjetas?',
})

export const SIGNALS_PREVIEW_STATES: SignalsPreviewState[] = [
  {
    id: 'calm-covered',
    title: 'Calma con cobertura completa',
    description: 'Sin alertas y con datos suficientes para una lectura tranquila.',
    model: model([]),
    amountsVisible: true,
  },
  {
    id: 'learning-new-user',
    title: 'Usuario nuevo',
    description: 'Sin falsa calma: Gota todavía está aprendiendo.',
    model: model([], {
      dataQuality: 'partial',
      coverage: coverage({ pace: 'learning', unusual: 'learning', wants: 'learning' }),
    }),
    amountsVisible: true,
  },
  {
    id: 'watch-pace',
    title: 'Atención por ritmo',
    description: 'Una señal watch con comparación porcentual.',
    model: model([watchPace]),
    amountsVisible: true,
  },
  {
    id: 'risk-card-liquidity',
    title: 'Riesgo de liquidez',
    description: 'Faltante para cubrir el próximo vencimiento de tarjeta.',
    model: model([liquidityRisk]),
    amountsVisible: true,
  },
  {
    id: 'multiple-signals',
    title: 'Múltiples señales',
    description: 'Riesgo y atención primero; contexto calmo después.',
    model: model([liquidityRisk, watchPace, unusual, subscription]),
    amountsVisible: true,
  },
  {
    id: 'needs-setup',
    title: 'Cobertura por configurar',
    description: 'Familias informativas que aún no se pueden activar.',
    model: model([], {
      dataQuality: 'insufficient',
      coverage: coverage({
        liquidity: 'needs_setup',
        cards: 'needs_setup',
        budget: 'needs_setup',
        installments: 'needs_setup',
        pace: 'learning',
        unusual: 'learning',
        wants: 'learning',
        goals: 'not_applicable',
        income: 'not_applicable',
        subscriptions: 'not_applicable',
      }),
    }),
    amountsVisible: true,
  },
  {
    id: 'masked',
    title: 'Montos ocultos',
    description: 'Lista, detalle, evidencia y pregunta sin filtraciones.',
    model: model([liquidityRisk, watchPace]),
    amountsVisible: false,
  },
  {
    id: 'long-evidence',
    title: 'Evidencia extensa',
    description: 'Prueba de scroll, valores tabulares y caveats largos.',
    model: model([longEvidence]),
    amountsVisible: true,
  },
]

export function resolveSignalsPreviewState(id: string | null): SignalsPreviewState {
  return SIGNALS_PREVIEW_STATES.find((state) => state.id === id) ?? SIGNALS_PREVIEW_STATES[0]
}
