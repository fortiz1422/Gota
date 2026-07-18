import { buildInsightCandidates } from './insight-rules'
import type {
  Currency,
  DataQuality,
  FinancialSnapshot,
  InsightCandidate,
  InsightKind,
  InsightSeverity,
} from './types'

export type SignalCoverageState =
  | 'active'
  | 'learning'
  | 'partial'
  | 'needs_setup'
  | 'not_applicable'
export type SignalBellTone = 'none' | 'new' | 'watch' | 'risk'

export type SignalDomain =
  | 'liquidity'
  | 'cards'
  | 'budget'
  | 'pace'
  | 'unusual'
  | 'installments'
  | 'wants'
  | 'goals'
  | 'income'
  | 'subscriptions'

export type SignalAction =
  | { type: 'navigate'; label: string; href: string }
  | { type: 'ask'; label: string; question: string }

export type SignalEvidenceItem = {
  label: string
  value: string
  asOf?: string
}

export type SignalOccurrence = {
  id: string
  occurrenceKey: string
  version: string
  kind: InsightKind
  domain: SignalDomain
  severity: InsightSeverity
  priority: number
  title: string
  summary: string
  message: string
  evidence: SignalEvidenceItem[]
  caveats: string[]
  dataQuality: DataQuality
  validUntil: string
  action: SignalAction | null
  askQuestion: string | null
  source: 'candidate'
}

export type SignalPresentation = Omit<
  SignalOccurrence,
  'id' | 'occurrenceKey' | 'version'
>

export type SignalCoverage = {
  family: SignalDomain
  state: SignalCoverageState
}

export type SignalCenterModel = {
  generatedAt: string
  month: string
  currency: Currency
  dataQuality: DataQuality
  signals: SignalOccurrence[]
  coverage: SignalCoverage[]
}

export type SignalOccurrenceIdentity = {
  occurrenceKey: string
  version: string
}

export type SignalIdentityResolver = (
  candidate: Readonly<InsightCandidate>,
) => SignalOccurrenceIdentity

export type BuildSignalCenterOptions = {
  generatedAt?: string
}

const MAX_ATTENTION_SIGNALS = 6
const MAX_CONTEXT_SIGNALS = 2

const DOMAIN_BY_KIND: Record<InsightKind, SignalDomain> = {
  liquidity_watch: 'liquidity',
  upcoming_card_due: 'cards',
  budget_acceleration: 'budget',
  same_day_spend_delta: 'pace',
  recent_unusual_movement: 'unusual',
  installment_load: 'installments',
  wants_creep: 'wants',
  goal_pace: 'goals',
  income_missing: 'income',
  subscription_load: 'subscriptions',
}

function projectAction(candidate: InsightCandidate): {
  action: SignalAction | null
  askQuestion: string | null
} {
  const source = candidate.actions[0]
  if (!source) return { action: null, askQuestion: null }
  if (source.href) {
    return {
      action: { type: 'navigate', label: source.label, href: source.href },
      askQuestion: null,
    }
  }
  if (source.question) {
    return {
      action: { type: 'ask', label: source.label, question: source.question },
      askQuestion: source.question,
    }
  }
  return { action: null, askQuestion: null }
}

export function projectSignalPresentation(
  candidate: Readonly<InsightCandidate>,
): SignalPresentation {
  const { action, askQuestion } = projectAction(candidate)
  return {
    kind: candidate.kind,
    domain: DOMAIN_BY_KIND[candidate.kind],
    severity: candidate.severity,
    priority: candidate.priority,
    title: candidate.title,
    summary: candidate.short,
    message: candidate.message,
    evidence: candidate.evidence.map(({ label, value, asOf }) => ({
      label,
      value,
      ...(asOf ? { asOf } : {}),
    })),
    caveats: [],
    dataQuality: candidate.dataQuality,
    validUntil: candidate.validUntil,
    action,
    askQuestion,
    source: 'candidate',
  }
}

function projectCandidate(
  candidate: InsightCandidate,
  identify: SignalIdentityResolver,
): SignalOccurrence {
  const identity = identify(candidate)
  return {
    id: identity.occurrenceKey,
    occurrenceKey: identity.occurrenceKey,
    version: identity.version,
    ...projectSignalPresentation(candidate),
  }
}

function snapshotDataQuality(snapshot: FinancialSnapshot): DataQuality {
  const coverage = Object.values(snapshot.coverage)
  if (coverage.some((source) => typeof source === 'object' && source.truncated)) return 'partial'
  if (snapshot.accountBalances.length === 0) return 'insufficient'
  return snapshot.availableCompletedMonths === 0 ? 'partial' : 'ok'
}

function buildCoverage(snapshot: FinancialSnapshot): SignalCoverage[] {
  const hasEnoughExpenseHistory = snapshot.availableCompletedMonths >= 3
  const historyState: SignalCoverageState = !hasEnoughExpenseHistory
    ? 'learning'
    : snapshot.coverage.expenses.truncated
      ? 'partial'
      : 'active'
  return [
    {
      family: 'liquidity',
      state: snapshot.accountBalances.length > 0 ? 'active' : 'needs_setup',
    },
    { family: 'cards', state: snapshot.cards.length > 0 ? 'active' : 'needs_setup' },
    { family: 'budget', state: snapshot.budget.plan ? 'active' : 'needs_setup' },
    { family: 'pace', state: historyState },
    { family: 'unusual', state: historyState },
    {
      family: 'installments',
      state: snapshot.cards.length > 0 ? 'active' : 'needs_setup',
    },
    { family: 'wants', state: historyState },
    {
      family: 'goals',
      state: snapshot.goalsDetail.length > 0 || snapshot.goals.count > 0 ? 'active' : 'not_applicable',
    },
    {
      family: 'income',
      state: snapshot.recurringIncomes.length > 0 ? 'active' : 'not_applicable',
    },
    {
      family: 'subscriptions',
      state: snapshot.subscriptions.length > 0 ? 'active' : 'not_applicable',
    },
  ]
}

/**
 * Aplica solamente reglas de presentación sobre la fuente canónica de
 * candidatos. Liquidez ya incorpora el vencimiento de tarjeta que explica el
 * hueco, por lo que mostrar ambos duplica el mismo riesgo.
 */
export function selectSignalCandidates(
  candidates: readonly InsightCandidate[],
): InsightCandidate[] {
  const presentsLiquidityRisk = candidates.some(
    (candidate) => candidate.kind === 'liquidity_watch',
  )
  const filtered = candidates.filter(
    (candidate) =>
      !presentsLiquidityRisk || candidate.kind !== 'upcoming_card_due',
  )
  const attention = filtered.filter(
    ({ severity }) => severity === 'risk' || severity === 'watch',
  )
  const context = filtered.filter(
    ({ severity }) => severity === 'info' || severity === 'positive',
  )

  return [
    ...attention.slice(0, MAX_ATTENTION_SIGNALS),
    ...context.slice(0, MAX_CONTEXT_SIGNALS),
  ]
}

export function buildSignalCenter(
  snapshot: FinancialSnapshot,
  identify: SignalIdentityResolver,
  options: BuildSignalCenterOptions = {},
): SignalCenterModel {
  const candidates = buildInsightCandidates(snapshot)
  return {
    generatedAt: options.generatedAt ?? `${snapshot.referenceDate}T00:00:00.000Z`,
    month: snapshot.month,
    currency: snapshot.currency,
    dataQuality: snapshotDataQuality(snapshot),
    signals: selectSignalCandidates(candidates).map((candidate) =>
      projectCandidate(candidate, identify),
    ),
    coverage: buildCoverage(snapshot),
  }
}
