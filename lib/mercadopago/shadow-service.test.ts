import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ observations: vi.fn(), history: vi.fn(), duplicate: vi.fn(), from: vi.fn(), upsert: vi.fn() }))
vi.mock('./server-repository', () => ({ getMercadoPagoMovementObservations: mocks.observations }))
vi.mock('./decision-history', () => ({ readMercadoPagoDecisionHistory: mocks.history, previousDecisionFor: vi.fn(() => null) }))
vi.mock('./ledger-matcher-repository', () => ({ checkMercadoPagoLedgerDuplicate: mocks.duplicate }))
vi.mock('./sync-lease', () => ({ backgroundDatabase: () => ({ from: mocks.from }) }))
import { runMercadoPagoShadow } from './shadow-service'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.history.mockResolvedValue([])
  mocks.from.mockReturnValue({ upsert: mocks.upsert })
  mocks.upsert.mockResolvedValue({ error: null })
  mocks.observations.mockResolvedValue([
    { id: 'raw-payment', source: 'payments_search', native_key: '1', last_seen_at: '2026-10-02T01:28:00Z', payload: { id: 1, payer: { id: 'owner' }, collector_id: 'merchant', operation_type: 'regular_payment', status: 'approved', transaction_amount: 32000, currency_id: 'ARS', date_created: '2026-10-02T01:27:00Z', payment_type_id: 'account_money', transaction_amount_refunded: 0 } },
    { id: 'raw-report', source: 'account_settlement_report', native_key: '1', last_seen_at: '2026-10-02T01:28:00Z', payload: { TRANSACTION_AMOUNT: -32000, TRANSACTION_CURRENCY: 'ARS', PAYMENT_METHOD_TYPE: 'account_money', TRANSACTION_TYPE: 'payment' } },
  ])
})

describe('shadow integrates dedupe without ledger mutations', () => {
  it.each([
    [{ checked: true, matches: [] }, 'auto_post', 'approved_mp_balance_expense'],
    [{ checked: true, matches: [{ expenseId: 'manual', merchantMatches: false }] }, 'review', 'possible_ledger_duplicate'],
    [{ checked: false, matches: [] }, 'review', 'ledger_dedupe_pending'],
  ])('audits the decision with the dedupe result', async (check, decision, reason) => {
    mocks.duplicate.mockResolvedValue(check)
    expect(await runMercadoPagoShadow('user', 'connection', 'owner', 'mp')).toBe(1)
    expect(mocks.duplicate.mock.calls[0].slice(1, 2)).toEqual(['user'])
    expect(mocks.from.mock.calls).toEqual([['mercadopago_shadow_decisions']])
    expect(mocks.upsert.mock.calls[0][0][0]).toMatchObject({ user_id: 'user', connection_id: 'connection', decision, rule_version: 3 })
    expect(mocks.upsert.mock.calls[0][0][0].reasons).toContain(reason)
    expect(JSON.stringify(mocks.upsert.mock.calls)).not.toContain('manual')
  })
  it('does not report success if audit persistence fails', async () => {
    mocks.duplicate.mockResolvedValue({ checked: true, matches: [] })
    mocks.upsert.mockResolvedValue({ error: { message: 'unavailable' } })
    await expect(runMercadoPagoShadow('user', 'connection', 'owner', 'mp')).rejects.toThrow('shadow_persist_failed')
  })
})
