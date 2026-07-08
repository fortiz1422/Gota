export type ChatIntent =
  | 'balance_status'
  | 'movement_lookup'
  | 'category_breakdown'
  | 'category_history'
  | 'trend_comparison'
  | 'budget_question'
  | 'card_commitments'
  | 'subscription_question'
  | 'yield_question'
  | 'goal_question'
  | 'what_should_i_do'
  | 'general'

export type PacketSection =
  | 'balances'
  | 'budget'
  | 'commitments'
  | 'subscriptions'
  | 'trend'
  | 'category_history'
  | 'categories'
  | 'goals'
  | 'yield'
  | 'insights'

export type MovementWindowKind =
  | 'today'
  | 'yesterday'
  | 'last_week'
  | 'this_month'
  | 'previous_month'
  | 'recent'

export type ChatQueryPlan = {
  intent: ChatIntent
  sections: PacketSection[]
  includeMovements: boolean
  movementFilter: {
    terms: string[]
    largeOnly: boolean
    kind: 'gasto' | 'ingreso' | null
    window: MovementWindowKind
    limit: number
  }
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const STOPWORDS = new Set([
  'sobre', 'para', 'como', 'cual', 'cuales', 'cuando', 'donde', 'este', 'esta',
  'estos', 'estas', 'ese', 'esos', 'mes', 'meses', 'ultimo', 'ultimos', 'ultima',
  'ultimas', 'gaste', 'gasto', 'gastos', 'gastando', 'ingreso', 'ingresos',
  'cuanto', 'cuanta', 'tengo', 'tuve', 'pasado', 'pasada', 'mostrame', 'decime',
  'grandes', 'grande', 'recientes', 'reciente', 'movimiento', 'movimientos',
  'quiero', 'saber', 'realmente', 'ahora', 'antes', 'despues', 'compre', 'pague',
  'promedio', 'historico', 'historica', 'normalmente', 'consumo', 'planificar',
])

export function extractSearchTerms(question: string): string[] {
  return normalizeText(question)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
}

/**
 * Detección de intención por patrones, ordenados de más específico a más
 * general. Determinística: misma pregunta → mismo intent.
 */
const INTENT_MATCHERS: Array<{ intent: ChatIntent; patterns: RegExp[] }> = [
  {
    intent: 'what_should_i_do',
    patterns: [
      /que deberia (mirar|hacer|revisar)/,
      /que (miro|hago|reviso) (hoy|ahora)/,
      /recomend/,
      /consejo/,
      /recortar/,
      /en que me fijo/,
      /algo (para|que) mirar/,
      /como vengo\b/,
    ],
  },
  {
    intent: 'budget_question',
    patterns: [/presupuest/, /pasado de/, /me pase (de|con)/, /\btope\b/, /\blimite\b/],
  },
  {
    intent: 'card_commitments',
    patterns: [
      /tarjeta/, /resumen/, /vencimiento/, /\bvence\b/, /compromiso/, /cuota/,
      /\bvisa\b/, /\bmaster(card)?\b/, /\bamex\b/, /debo pagar/,
    ],
  },
  {
    intent: 'subscription_question',
    patterns: [
      /suscripcion/, /netflix|spotify|disney|hbo|prime|youtube|apple/,
      /debito automatico/, /servicios que pago/,
    ],
  },
  {
    intent: 'yield_question',
    patterns: [/rendimiento/, /\binteres(es)?\b/, /\bfci\b/, /plazo fijo/, /\brinde\b/, /rendir/],
  },
  {
    intent: 'goal_question',
    patterns: [/\bmetas?\b/, /objetivo/, /ahorrando para/],
  },
  {
    intent: 'category_history',
    patterns: [
      /promedio.*(gasto|consumo)/,
      /(gasto|consumo).*promedio/,
      /historico.*(gasto|consumo)/,
      /(gasto|consumo).*historico/,
      /cuanto gasto normalmente/,
      /cuanto vengo gastando/,
      /presupuesto recomendado/,
      /cuanto deberia presupuestar/,
    ],
  },
  {
    intent: 'trend_comparison',
    patterns: [
      /compar/, /\bvs\b/, /meses anteriores/, /mes pasado/, /a esta altura/,
      /que cambio/, /tendencia/, /evolucion/, /venia gastando/,
    ],
  },
  {
    intent: 'balance_status',
    patterns: [
      /cuanto (me )?queda/, /disponible/, /\bsaldo/, /\bplata\b/, /cuanto tengo/,
      /me alcanza/, /\blibre\b/,
    ],
  },
  {
    intent: 'movement_lookup',
    patterns: [
      /movimiento/, /gastos? (grandes?|fuertes?|importantes?)/, /compras? grandes?/,
      /cuando (compre|pague|gaste)/, /detalle/, /transaccion/, /mostrame/, /listame/,
    ],
  },
  {
    intent: 'category_breakdown',
    patterns: [
      /en que (estoy gastando|gasto|gaste|se (me )?va)/,
      /donde (estoy gastando|gasto|gaste|se (me )?va)/,
      /categoria/, /\btop\b/, /que gaste mas/, /gastando mas/,
    ],
  },
]

export function detectIntent(question: string): ChatIntent {
  const normalized = normalizeText(question)
  for (const matcher of INTENT_MATCHERS) {
    if (matcher.patterns.some((pattern) => pattern.test(normalized))) {
      return matcher.intent
    }
  }
  return 'general'
}

const SECTIONS_BY_INTENT: Record<ChatIntent, PacketSection[]> = {
  balance_status: ['balances', 'commitments', 'goals'],
  movement_lookup: ['categories'],
  category_breakdown: ['categories', 'budget'],
  category_history: ['category_history', 'budget'],
  trend_comparison: ['trend', 'categories'],
  budget_question: ['budget', 'categories'],
  card_commitments: ['commitments', 'subscriptions'],
  subscription_question: ['subscriptions'],
  yield_question: ['yield', 'balances'],
  goal_question: ['goals', 'balances'],
  what_should_i_do: ['insights', 'balances', 'budget', 'commitments'],
  general: ['balances', 'categories', 'trend', 'budget', 'commitments'],
}

function detectWindow(normalized: string): MovementWindowKind {
  if (/\bhoy\b/.test(normalized)) return 'today'
  if (/\bayer\b/.test(normalized)) return 'yesterday'
  if (/semana/.test(normalized)) return 'last_week'
  if (/mes (pasado|anterior)/.test(normalized)) return 'previous_month'
  if (/este mes/.test(normalized)) return 'this_month'
  return 'recent'
}

export function planChatQuery(question: string): ChatQueryPlan {
  const intent = detectIntent(question)
  const normalized = normalizeText(question)

  const largeOnly = /grande|fuerte|importante|caro|alto/.test(normalized)
  // "Movimientos grandes" sin más contexto refiere a gastos: los ingresos
  // solo entran si se piden explícitamente.
  const kind = /ingreso|cobre|sueldo|me pagaron/.test(normalized)
    ? ('ingreso' as const)
    : /gasto|gaste|compre|pague|compra/.test(normalized) || largeOnly
      ? ('gasto' as const)
      : null

  const includeMovements =
    intent === 'movement_lookup' ||
    (intent === 'general' && extractSearchTerms(question).length > 0)

  return {
    intent,
    sections: SECTIONS_BY_INTENT[intent],
    includeMovements,
    movementFilter: {
      terms:
        intent === 'movement_lookup' ||
        intent === 'general' ||
        intent === 'category_history' ||
        intent === 'budget_question'
          ? extractSearchTerms(question)
          : [],
      largeOnly,
      kind,
      window: detectWindow(normalized),
      limit: largeOnly ? 8 : 12,
    },
  }
}
