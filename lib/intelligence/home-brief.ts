import { formatAmount } from '@/lib/format'
import { moneyEvidence } from './evidence'
import { maskAmounts, resolveMoneyBasis, type HomeDisplayContext } from './home-display-context'
import { buildInsightCandidates } from './insight-rules'
import { computeSafeToSpend } from './projection'
import type {
  EvidenceItem,
  FinancialSnapshot,
  HomeBrief,
  InsightAction,
  InsightCandidate,
  InsightKind,
} from './types'

const MAX_BRIEF_EVIDENCE = 2

/**
 * Acción nativa por tipo de señal cuando la regla solo trae 'Preguntar'.
 * Reusa superficies existentes; no inventa rutas nuevas.
 */
const NATIVE_ACTION_BY_KIND: Partial<Record<InsightKind, InsightAction>> = {
  upcoming_card_due: { label: 'Ver compromisos', href: '/analytics?drill=compromisos' },
  liquidity_watch: { label: 'Ver compromisos', href: '/analytics?drill=compromisos' },
}

/**
 * Grupos de correlación: señales que suelen contar la misma historia
 * subyacente. Solo una del grupo puede sostener la lectura; el resto no
 * cuenta como señal secundaria.
 */
const CORRELATION_GROUP: Partial<Record<InsightKind, string>> = {
  liquidity_watch: 'cash_commitments',
  upcoming_card_due: 'cash_commitments',
}

function homeScore(candidate: InsightCandidate): number {
  let score = candidate.priority
  // Accionabilidad nativa y calidad de datos pesan en Home más que en chat.
  if (candidate.actions.some((action) => action.href) || NATIVE_ACTION_BY_KIND[candidate.kind]) {
    score += 30
  }
  if (candidate.dataQuality === 'ok') score += 20
  return score
}

function nativeAction(candidate: InsightCandidate): InsightAction | null {
  return (
    candidate.actions.find((action) => action.href) ?? NATIVE_ACTION_BY_KIND[candidate.kind] ?? null
  )
}

function askQuestionOf(candidate: InsightCandidate): string | null {
  return candidate.actions.find((action) => action.question)?.question ?? null
}

function statusOf(candidate: InsightCandidate): HomeBrief['status'] {
  if (candidate.severity === 'risk') return 'risk'
  if (candidate.severity === 'watch') return 'watch'
  return 'calm'
}

function maskBrief(brief: HomeBrief): HomeBrief {
  return {
    ...brief,
    headline: maskAmounts(brief.headline),
    summary: maskAmounts(brief.summary),
    evidence: brief.evidence.map((item) => ({ ...item, value: maskAmounts(item.value) })),
  }
}

/**
 * Compone la única lectura editorial del Home a partir de las señales
 * deterministas: elige una historia, deduplica causas correlacionadas,
 * acota la evidencia visible y resuelve acción nativa + pregunta secundaria.
 * Puro: no hace IO ni renderiza.
 */
export function buildHomeBrief(
  snapshot: FinancialSnapshot,
  context: HomeDisplayContext,
  options?: { generatedAt?: string },
): HomeBrief {
  const generatedAt = options?.generatedAt ?? new Date().toISOString()
  const moneyBasis = resolveMoneyBasis(context)
  const base = {
    generatedAt,
    moneyBasis,
    askQuestion: null as string | null,
    primaryAction: null as InsightAction | null,
    secondaryCount: 0,
    sourceInsightIds: [] as string[],
  }

  // 'positive' se excluye: el Home no celebra con cards verdes; la calma ya
  // comunica que está todo cubierto.
  const candidates = buildInsightCandidates(snapshot)
    .filter((candidate) => candidate.severity !== 'positive')
    .sort((a, b) => homeScore(b) - homeScore(a) || a.kind.localeCompare(b.kind))

  const selected = candidates[0] ?? null

  if (selected) {
    const selectedGroup = CORRELATION_GROUP[selected.kind]
    const rest = candidates.slice(1).filter(
      // Una señal correlacionada con la elegida repite la misma historia.
      (candidate) =>
        selectedGroup === undefined || CORRELATION_GROUP[candidate.kind] !== selectedGroup,
    )
    const distinctDomains = new Set(rest.map((candidate) => candidate.kind))

    const brief: HomeBrief = {
      ...base,
      status: statusOf(selected),
      headline: selected.title,
      summary: selected.message,
      evidence: selected.evidence.slice(0, MAX_BRIEF_EVIDENCE),
      primaryAction: nativeAction(selected),
      askQuestion: askQuestionOf(selected),
      secondaryCount: distinctDomains.size,
      validUntil: selected.validUntil,
      sourceInsightIds: [selected.id],
    }
    return context.amountsVisible ? brief : maskBrief(brief)
  }

  // Sin señales: calma solo si hay base para afirmarla; si no, learning.
  const safe = computeSafeToSpend(snapshot)
  const hasBaseline = snapshot.availableCompletedMonths > 0
  const currency = snapshot.currency

  if (safe.dataQuality === 'ok' && hasBaseline) {
    const evidence: EvidenceItem[] = [
      moneyEvidence('Libre hasta fin de mes', safe.spendable, currency, 'projection:spendable'),
    ]
    if (safe.dailyAmount !== null) {
      evidence.push(
        moneyEvidence('Margen diario', safe.dailyAmount, currency, 'projection:safe_to_spend'),
      )
    }
    const brief: HomeBrief = {
      ...base,
      status: 'calm',
      headline:
        safe.dailyAmount !== null
          ? `Estás cubierto: margen de ${formatAmount(safe.dailyAmount, currency)}/día`
          : 'Estás cubierto hasta fin de mes',
      summary: `Con débitos y metas ya descontados te quedan ${formatAmount(Math.round(safe.spendable), currency)} libres por los próximos ${safe.daysLeft} días.`,
      evidence,
      askQuestion: '¿Qué debería mirar hoy?',
      validUntil: snapshot.referenceDate,
      sourceInsightIds: [],
    }
    return context.amountsVisible ? brief : maskBrief(brief)
  }

  const brief: HomeBrief = {
    ...base,
    status: 'learning',
    headline: 'Gota está aprendiendo tus patrones',
    summary:
      'Todavía no hay histórico suficiente para leer tu mes con confianza. Con algunas semanas más de movimientos, la lectura diaria aparece acá.',
    evidence: [],
    askQuestion: null,
    validUntil: snapshot.referenceDate,
    sourceInsightIds: [],
  }
  return brief
}
