import { buildInsightCandidates } from './insight-rules'
import { computeSafeToSpend } from './projection'
import type {
  Currency,
  EvidenceItem,
  FinancialSnapshot,
  InsightAction,
  InsightSeverity,
} from './types'

export type IntelligenceHero = {
  id: string
  kind: string
  severity: InsightSeverity
  priority: number
  title: string
  message: string
  evidence: EvidenceItem[]
  cta?: InsightAction
}

/** Ritmo del mes: cuánto queda libre por día tras compromisos y metas. */
export type IntelligencePulse = {
  spendable: number
  dailyAmount: number | null
  daysLeft: number
  committedRemaining: number
  goalCommitted: number
}

export type IntelligenceHeroResponse = {
  generatedAt: string
  month: string
  currency: Currency
  heroes: IntelligenceHero[]
  pulse: IntelligencePulse | null
}

const MAX_HEROES = 4
const MAX_EVIDENCE_PER_HERO = 3

/**
 * Compone la respuesta de héroes a partir de los insight candidates.
 * Determinístico: el copy viene de las reglas, no del LLM.
 */
export function buildHeroesResponse(
  snapshot: FinancialSnapshot,
  options?: { maxHeroes?: number; generatedAt?: string },
): IntelligenceHeroResponse {
  const maxHeroes = options?.maxHeroes ?? MAX_HEROES
  const candidates = buildInsightCandidates(snapshot)
  const safeToSpend = computeSafeToSpend(snapshot)
  const pulse: IntelligencePulse | null =
    safeToSpend.dataQuality === 'ok'
      ? {
          spendable: Math.round(safeToSpend.spendable),
          dailyAmount: safeToSpend.dailyAmount,
          daysLeft: safeToSpend.daysLeft,
          committedRemaining: Math.round(safeToSpend.committedRemaining),
          goalCommitted: Math.round(safeToSpend.goalCommitted),
        }
      : null

  return {
    generatedAt: options?.generatedAt ?? new Date().toISOString(),
    month: snapshot.month,
    currency: snapshot.currency,
    pulse,
    heroes: candidates.slice(0, maxHeroes).map((candidate) => ({
      id: candidate.id,
      kind: candidate.kind,
      severity: candidate.severity,
      priority: candidate.priority,
      title: candidate.title,
      message: candidate.message,
      evidence: candidate.evidence.slice(0, MAX_EVIDENCE_PER_HERO),
      cta: candidate.actions[0],
    })),
  }
}
