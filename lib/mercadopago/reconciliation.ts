import type { NormalizedMercadoPagoMovement } from './provider-movement'

export type ReconciliationObservation = {
  source: 'payments_search' | 'account_settlement_report'
  nativeId: string | null
  lastSeenAt: string
  movement: NormalizedMercadoPagoMovement
}

type BalanceImpact = {
  observed: boolean
  effect: 'debit' | 'credit' | 'zero' | 'unknown'
  amount: { value: number | null; currency: string | null }
}

export type ReconciledMercadoPagoMovement = NormalizedMercadoPagoMovement & {
  candidateId: string
  sources: ReconciliationObservation['source'][]
  match: 'exact_native_id' | 'single_source'
  balanceImpact: BalanceImpact
  settlement: NormalizedMercadoPagoMovement | null
}

export type ReconciliationResult = ReconciledMercadoPagoMovement[] & {
  aggregates: {
    total: number
    observations: number
    crossSourceMatches: number
    paymentOnly: number
    balanceOnly: number
    income: number
    expense: number
    transfer: number
    neutral: number
    unknown: number
    partial: number
    confirmed: number
  }
}

const SOURCES: ReconciliationObservation['source'][] = ['payments_search', 'account_settlement_report']
const sourceRank = (source: ReconciliationObservation['source']) => SOURCES.indexOf(source)
const validNativeId = (value: string | null): value is string => Boolean(value?.trim())
const timestamp = (value: string | null) => {
  const parsed = value ? Date.parse(value) : Number.NEGATIVE_INFINITY
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

function balanceImpact(settlement: NormalizedMercadoPagoMovement | null): BalanceImpact {
  if (!settlement) return { observed: false, effect: 'unknown', amount: { value: null, currency: null } }
  const value = settlement.amount.value
  return {
    observed: true,
    effect: value === null ? 'unknown' : value < 0 ? 'debit' : value > 0 ? 'credit' : 'zero',
    amount: { value, currency: settlement.amount.currency },
  }
}

function candidate(observations: ReconciliationObservation[], match: ReconciledMercadoPagoMovement['match'], ordinal: number): ReconciledMercadoPagoMovement {
  const payment = observations.find((observation) => observation.source === 'payments_search')?.movement ?? null
  const settlement = observations.find((observation) => observation.source === 'account_settlement_report')?.movement ?? null
  const primary = payment ?? settlement as NormalizedMercadoPagoMovement
  const nativeId = primary.nativeId
  const sourceKey = observations.map((observation) => observation.source).sort((a, b) => sourceRank(a) - sourceRank(b)).join('+')
  return {
    ...primary,
    candidateId: `${sourceKey}:${nativeId ?? 'unknown'}:${ordinal}`,
    nativeId,
    sources: observations.map((observation) => observation.source).sort((a, b) => sourceRank(a) - sourceRank(b)),
    match,
    balanceImpact: balanceImpact(settlement),
    settlement,
  }
}

function compare(left: ReconciledMercadoPagoMovement, right: ReconciledMercadoPagoMovement) {
  const leftDate = timestamp(left.occurredAt ?? left.settlement?.occurredAt ?? null)
  const rightDate = timestamp(right.occurredAt ?? right.settlement?.occurredAt ?? null)
  if (leftDate !== rightDate) return rightDate - leftDate
  return left.candidateId.localeCompare(right.candidateId)
}

export function reconcileMercadoPagoMovements(observations: ReconciliationObservation[]): ReconciliationResult {
  const grouped = new Map<string, ReconciliationObservation[]>()
  const standalone: ReconciliationObservation[] = []
  for (const observation of observations) {
    if (!validNativeId(observation.nativeId)) {
      standalone.push(observation)
      continue
    }
    const group = grouped.get(observation.nativeId) ?? []
    group.push(observation)
    grouped.set(observation.nativeId, group)
  }

  const candidates: ReconciledMercadoPagoMovement[] = [...standalone.map((observation, index) => candidate([observation], 'single_source', index))]
  for (const group of grouped.values()) {
    const payments = group.filter((observation) => observation.source === 'payments_search')
    const settlements = group.filter((observation) => observation.source === 'account_settlement_report')
    if (payments.length <= 1 && settlements.length <= 1) {
      candidates.push(candidate(group, payments.length && settlements.length ? 'exact_native_id' : 'single_source', candidates.length))
    } else {
      for (const observation of [...payments, ...settlements]) candidates.push(candidate([observation], 'single_source', candidates.length))
    }
  }

  candidates.sort(compare)
  const aggregates = {
    total: candidates.length,
    observations: observations.length,
    crossSourceMatches: candidates.filter((movement) => movement.match === 'exact_native_id').length,
    paymentOnly: candidates.filter((movement) => movement.sources.length === 1 && movement.sources[0] === 'payments_search').length,
    balanceOnly: candidates.filter((movement) => movement.sources.length === 1 && movement.sources[0] === 'account_settlement_report').length,
    income: candidates.filter((movement) => movement.kind === 'income').length,
    expense: candidates.filter((movement) => movement.kind === 'expense').length,
    transfer: candidates.filter((movement) => movement.kind === 'transfer').length,
    neutral: candidates.filter((movement) => movement.kind === 'neutral').length,
    unknown: candidates.filter((movement) => movement.kind === 'unknown').length,
    partial: candidates.filter((movement) => movement.confidence === 'partial').length,
    confirmed: candidates.filter((movement) => movement.confidence === 'confirmed').length,
  }
  return Object.assign(candidates, { aggregates })
}
