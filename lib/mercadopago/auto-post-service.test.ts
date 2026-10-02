import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeMercadoPagoMovement } from './provider-movement'
import { reconcileMercadoPagoMovements } from './reconciliation'
const mocks = vi.hoisted(() => ({ db: vi.fn(), connection: vi.fn(), observations: vi.fn(), history: vi.fn(), reconstruct: vi.fn(), duplicate: vi.fn(), rpc: vi.fn(), single: vi.fn() }))
vi.mock('./sync-lease', () => ({ backgroundDatabase: mocks.db }))
vi.mock('./server-repository', () => ({ getMercadoPagoConnection: mocks.connection, getMercadoPagoMovementObservations: mocks.observations }))
vi.mock('./decision-history', () => ({ readMercadoPagoDecisionHistory: mocks.history, previousDecisionFor: () => null }))
vi.mock('./duplicate-resolution', () => ({ readMercadoPagoDuplicateSnapshot: mocks.duplicate }))
vi.mock('./confirm-expense', async original => ({ ...await original<object>(), reconstructMercadoPagoCandidates: mocks.reconstruct }))
import { runMercadoPagoAutoPost } from './auto-post-service'
function purchase(change: Record<string, unknown> = {}) {
  const payment = normalizeMercadoPagoMovement({ source: 'payments_search', providerUserId: 'me', payload: { id: 1, payer_id: 'me', operation_type: 'regular_payment', status: 'approved', transaction_amount: 1000, transaction_amount_refunded: 0, currency_id: 'ARS', payment_type_id: 'account_money', date_created: '2026-10-02T01:00:00Z', ...change } })
  const settlement = normalizeMercadoPagoMovement({ source: 'account_settlement_report', providerUserId: 'me', nativeKey: '1', payload: { TRANSACTION_AMOUNT: -1000, TRANSACTION_CURRENCY: 'ARS', TRANSACTION_TYPE: 'payment', PAYMENT_METHOD_TYPE: 'account_money', TRANSACTION_DATE: '2026-10-02T01:00:00Z' } })
  return reconcileMercadoPagoMovements([payment, settlement].map((movement,i) => ({ id: 'raw-'+i, source: movement.source, nativeId: movement.nativeId, nativeKey: '1', movement, lastSeenAt: '2026-10-02T02:00:00Z' })))
}
beforeEach(() => {
  vi.clearAllMocks();vi.stubEnv('MERCADOPAGO_AUTO_POST_ENABLED','true');vi.stubEnv('MERCADOPAGO_POSTING_ENABLED','true')
  const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: mocks.single }
  mocks.db.mockReturnValue({ from: () => query, rpc: mocks.rpc })
  mocks.single.mockResolvedValue({ data: { auto_post_enabled: true }, error: null })
  mocks.connection.mockResolvedValue({ id:'connection', status:'connected', linked_account_id:'mp', linked_account_version:2 })
  mocks.history.mockResolvedValue([]);mocks.observations.mockResolvedValue([]);mocks.reconstruct.mockReturnValue(purchase())
  mocks.duplicate.mockResolvedValue({ rows: [], fingerprint:'x' });mocks.rpc.mockResolvedValue({ data:'expense', error:null })
})
afterEach(() => vi.unstubAllEnvs())
describe('gated automatic balance posting', () => {
  it('does not read data when deployment auto-post is disabled', async () => {
    vi.stubEnv('MERCADOPAGO_AUTO_POST_ENABLED','false')
    expect(await runMercadoPagoAutoPost('user','connection')).toEqual({ posted:0,state:'disabled' });expect(mocks.db).not.toHaveBeenCalled()
  })
  it('requires connection opt-in before reading RAW', async () => {
    mocks.single.mockResolvedValue({ data:{auto_post_enabled:false},error:null })
    expect((await runMercadoPagoAutoPost('user','connection')).posted).toBe(0);expect(mocks.observations).not.toHaveBeenCalled()
  })
  it('sends full evidence to audited RPC with Argentina date and neutral category fallback', async () => {
    expect((await runMercadoPagoAutoPost('user','connection')).posted).toBe(1)
    expect(mocks.rpc).toHaveBeenCalledWith('post_mercadopago_balance_event',expect.objectContaining({ p_amount:1000,p_date:'2026-10-01',p_category:'Otros',p_decision_source:'auto',p_action:'post',p_expected_linked_account_version:2 }))
  })
  it.each([{ operation_type:'money_transfer' },{ transaction_amount_refunded:10 },{ payment_type_id:'credit_card', installments:3 },{ status:'rejected' }])('never posts unsafe financial evidence %j',async change => {
    mocks.reconstruct.mockReturnValue(purchase(change));expect((await runMercadoPagoAutoPost('user','connection')).posted).toBe(0);expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('does not post a possible manual duplicate',async()=>{
    mocks.duplicate.mockResolvedValue({rows:[{id:'manual'}]});expect((await runMercadoPagoAutoPost('user','connection')).posted).toBe(0);expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('fails closed on dedupe read failure',async()=>{
    mocks.duplicate.mockRejectedValue(Error('unavailable'));await expect(runMercadoPagoAutoPost('user','connection')).rejects.toThrow();expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('leaves stale candidates untouched and does not fall back to an unsafe RPC',async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:'55000'}});expect((await runMercadoPagoAutoPost('user','connection')).posted).toBe(0);expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
})
