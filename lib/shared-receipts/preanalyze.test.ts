import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  canUsePaidAI: vi.fn(),
  checkRateLimit: vi.fn(),
  analyzeSharedReceipt: vi.fn(),
  generateUniversalReceiptProposal: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}))
vi.mock('@/lib/paid-ai-policy', () => ({ canUsePaidAI: mocks.canUsePaidAI }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('./operations', () => ({
  analyzeSharedReceipt: mocks.analyzeSharedReceipt,
}))
vi.mock('./analyzer', () => ({
  generateUniversalReceiptProposal: mocks.generateUniversalReceiptProposal,
}))
import { preanalyzeReceivedReceipt } from './preanalyze'

beforeEach(() => {
  vi.resetAllMocks()
})
describe('preanalysis after ingest', () => {
  it('does not spend AI budget for unavailable, anonymous or disallowed users', async () => {
    const admin = {
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { id: 'owner' } },
            error: null,
          })),
        },
      },
    }
    mocks.createAdminClient.mockReturnValue(admin)
    mocks.canUsePaidAI.mockReturnValue(false)
    await preanalyzeReceivedReceipt('owner', 'receipt')
    expect(admin.auth.admin.getUserById).toHaveBeenCalledWith('owner')
    expect(mocks.checkRateLimit).not.toHaveBeenCalled()
    expect(mocks.analyzeSharedReceipt).not.toHaveBeenCalled()
  })
  it('uses the existing per-user paid-AI budget and never retries automatically', async () => {
    mocks.createAdminClient.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { id: 'owner' } },
            error: null,
          })),
        },
      },
    })
    mocks.canUsePaidAI.mockReturnValue(true)
    mocks.checkRateLimit.mockReturnValue(false)
    await preanalyzeReceivedReceipt('owner', 'receipt')
    expect(mocks.checkRateLimit).toHaveBeenCalledWith('receipt-ai:owner', 5)
    expect(mocks.analyzeSharedReceipt).not.toHaveBeenCalled()
  })
  it('claims only a received receipt owned by the authenticated device owner', async () => {
    const query = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    }
    const admin = {
      auth: {
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { id: 'owner' } },
            error: null,
          })),
        },
      },
      from: vi.fn(() => query),
    }
    mocks.createAdminClient.mockReturnValue(admin)
    mocks.canUsePaidAI.mockReturnValue(true)
    mocks.checkRateLimit.mockReturnValue(true)
    mocks.analyzeSharedReceipt.mockImplementation(
      async (userId, receiptId, deps) => {
        await deps.claimOwned(userId, receiptId)
        return { status: 404 }
      }
    )
    await preanalyzeReceivedReceipt('owner', 'receipt')
    expect(query.eq.mock.calls).toEqual([
      ['id', 'receipt'],
      ['user_id', 'owner'],
      ['status', 'received'],
    ])
    expect(mocks.analyzeSharedReceipt).toHaveBeenCalledTimes(1)
    expect(admin.from).toHaveBeenCalledWith('shared_receipts')
  })
})
