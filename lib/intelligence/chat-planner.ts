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
  | 'affordability'
  | 'wants_question'
  | 'installment_question'
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
  | 'affordability'
  | 'wants'
  | 'installments'

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
    wantsOnly: boolean
    window: MovementWindowKind
    limit: number
  }
  /** Monto y cuotas detectados para simular una compra ("¿me alcanza?"). */
  simulation: {
    amount: number | null
    installments: number | null
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
    intent: 'affordability',
    patterns: [
      /me alcanza/,
      /puedo (comprar|gastar|pagar|permitirme|darme)/,
      /me da (para|el cuero)/,
      /si (compro|gasto|pago)\b/,
      /cuanto puedo gastar/,
      /entra en (mi|el) (mes|presupuesto|bolsillo)/,
      /conviene comprar/,
    ],
  },
  {
    intent: 'wants_question',
    // "deseo" solo cuenta como sustantivo ("en deseos"), no "deseo saber...".
    patterns: [
      /\bdeseos\b/, /\ben deseo\b/, /gast(o|e|ando).*deseo/, /antojo/, /caprich/,
      /impulsiv/, /darme (un|el) gusto/, /\bgustos\b/, /necesidad (vs|versus|o) deseo/,
    ],
  },
  {
    intent: 'installment_question',
    patterns: [/cuota/, /financiaci/, /financiado/, /comprometido para (los|el)/],
  },
  {
    intent: 'budget_question',
    patterns: [/presupuest/, /pasado de/, /me pase (de|con)/, /\btope\b/, /\blimite\b/],
  },
  {
    intent: 'card_commitments',
    patterns: [
      /tarjeta/, /resumen/, /vencimiento/, /\bvence\b/, /compromiso/,
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
  affordability: ['affordability', 'balances', 'commitments'],
  wants_question: ['wants', 'categories'],
  installment_question: ['installments', 'commitments'],
  what_should_i_do: ['insights', 'balances', 'budget', 'commitments'],
  general: ['balances', 'categories', 'trend', 'budget', 'commitments'],
}

// ─── Extracción de monto y cuotas para simulaciones ──────────────────────────

const INSTALLMENTS_PATTERN = /(\d{1,2})\s*cuotas?/

function parseAmountToken(token: string, suffix: string | undefined): number | null {
  let value: number
  if (/^\d{1,3}(\.\d{3})+$/.test(token)) {
    value = Number(token.replace(/\./g, ''))
  } else if (/^\d+,\d{1,2}$/.test(token)) {
    value = Number(token.replace(',', '.'))
  } else if (/^\d+$/.test(token)) {
    value = Number(token)
  } else {
    return null
  }
  if (!Number.isFinite(value) || value <= 0) return null

  if (suffix === 'k' || suffix === 'mil' || suffix === 'lucas') return value * 1_000
  if (suffix === 'palo' || suffix === 'palos') return value * 1_000_000
  return value
}

/**
 * Detecta monto y cantidad de cuotas en la pregunta ("¿me alcanza para algo
 * de 250 lucas en 6 cuotas?"). Determinístico; devuelve null si no hay monto
 * inequívoco.
 */
export function extractSimulation(question: string): {
  amount: number | null
  installments: number | null
} {
  const normalized = normalizeText(question)
  const installmentsMatch = normalized.match(INSTALLMENTS_PATTERN)
  const installments = installmentsMatch ? Number(installmentsMatch[1]) : null
  // El número de cuotas no debe confundirse con el monto.
  const withoutInstallments = installmentsMatch
    ? normalized.replace(installmentsMatch[0], ' ')
    : normalized

  const amounts: number[] = []
  const pattern = /(\d[\d.,]*)\s*(k|mil|lucas|palos?)?\b/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(withoutInstallments)) !== null) {
    const parsed = parseAmountToken(match[1].replace(/[.,]$/, ''), match[2])
    if (parsed !== null) amounts.push(parsed)
  }

  // Montos de una compra real: se descartan números chicos sueltos (días, cantidades).
  const candidates = amounts.filter((amount) => amount >= 1_000)
  return {
    amount: candidates.length > 0 ? Math.max(...candidates) : null,
    installments: installments && installments > 1 ? installments : null,
  }
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
    intent === 'wants_question' ||
    (intent === 'general' && extractSearchTerms(question).length > 0)

  const wantsOnly = intent === 'wants_question'

  return {
    intent,
    sections: SECTIONS_BY_INTENT[intent],
    includeMovements,
    movementFilter: {
      terms:
        intent === 'movement_lookup' ||
        intent === 'general' ||
        intent === 'category_history' ||
        intent === 'budget_question' ||
        intent === 'trend_comparison'
          ? extractSearchTerms(question)
          : [],
      largeOnly,
      kind: wantsOnly ? 'gasto' : kind,
      wantsOnly,
      window: wantsOnly && detectWindow(normalized) === 'recent' ? 'this_month' : detectWindow(normalized),
      limit: largeOnly || wantsOnly ? 8 : 12,
    },
    simulation:
      intent === 'affordability' ? extractSimulation(question) : { amount: null, installments: null },
  }
}
