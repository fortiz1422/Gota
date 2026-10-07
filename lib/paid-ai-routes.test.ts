import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ client: vi.fn(), user: vi.fn(), admin: vi.fn(), model: vi.fn(), receipt: vi.fn(), snapshot: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.client }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/gemini/client', () => ({ geminiModel: { generateContent: mocks.model } }))
vi.mock('@/lib/shared-receipts/analyzer', () => ({ generateUniversalReceiptProposal: mocks.receipt }))
vi.mock('@/lib/intelligence/snapshot', () => ({ loadFinancialSnapshot: mocks.snapshot }))
vi.mock('@/lib/flags', () => ({ FF_GOTA_ASSISTANT: true }))
import { POST as assistant } from '@/app/api/assistant/route'
import { POST as receipt } from '@/app/api/shared-receipts/[id]/analyze/route'
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('GOTA_PAID_AI_ENABLED', 'true')
  vi.stubEnv('GOTA_PAID_AI_USER_IDS', 'owner')
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.user } })
})
afterEach(() => vi.unstubAllEnvs())
describe('all paid entry points enforce the public boundary', () => {
  it.each([{ id: 'guest', is_anonymous: true }, { id: 'public-user', is_anonymous: false }])('blocks %j before snapshot, storage or generation', async user => {
    mocks.user.mockResolvedValue({ data: { user } })
    const req = () => new Request('https://gota.test/api/test', { method: 'POST', body: '{}' })
    expect((await assistant(req())).status).toBe(403)
    expect((await receipt(req(), { params: Promise.resolve({ id: 'synthetic-receipt' }) })).status).toBe(403)
    expect(mocks.snapshot).not.toHaveBeenCalled()
    expect(mocks.admin).not.toHaveBeenCalled()
    expect(mocks.model).not.toHaveBeenCalled()
    expect(mocks.receipt).not.toHaveBeenCalled()
  })
  it('rejects requests without a session', async () => {
    mocks.user.mockResolvedValue({ data: { user: null } })
    const req = new Request('https://gota.test/api/test', { method: 'POST', body: '{}' })
    expect((await assistant(req)).status).toBe(401)
    expect((await receipt(req, { params: Promise.resolve({ id: 'synthetic-receipt' }) })).status).toBe(401)
    expect(mocks.admin).not.toHaveBeenCalled()
  })
})
