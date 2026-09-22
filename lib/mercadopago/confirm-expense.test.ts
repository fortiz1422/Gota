import { describe, expect, it } from 'vitest'
import { candidateFingerprint, buildConfirmationIntentHash, buildCanonicalSemantics } from './confirm-expense'

describe('Mercado Pago expense confirmation canonical contract', () => {
  it('exports stable fingerprint independent of lastSeenAt', () => {
    const candidate = { candidateId: 'sha256:x', evidence: [{ id: 'raw-1', source: 'payments_search', native_key: 'p1', last_seen_at: '2026-01-01', movement: { amount: { value: 5500, currency: 'ARS' }, occurredAt: '2026-09-15' } }] }
    expect(candidateFingerprint(candidate)).toMatch(/^[a-f0-9]{64}$/)
    expect(candidateFingerprint({ ...candidate, evidence: [{ ...candidate.evidence[0], last_seen_at: '2026-02-01' }] })).toBe(candidateFingerprint(candidate))
  })

  it('hashes only canonical human intent, never a browser-selected account', () => {
    expect(buildCanonicalSemantics()).toEqual({ classification: 'human_confirmed_expense', provider_effect: 'balance_debit' })
    expect(buildConfirmationIntentHash({ description: ' Shell ', category: 'Otros', isWant: false })).toMatch(/^[a-f0-9]{64}$/)
  })
})
