import { describe, expect, it } from 'vitest'
import {
  parsePendingMerchantMemory,
  pendingMerchantMemoryFromDraft,
  retryDraftFromPending,
  isMissingPendingMerchantMemoryColumn,
} from './pending-merchant-memory'
import type { BulkReceiptDraft } from './bulk-review'

const draft = (): BulkReceiptDraft => ({
  receipt: {
    id: '20000000-0000-4000-8000-000000000001',
    status: 'needs_review',
    created_at: '2026-10-22T15:00:00Z',
    detected_alias: 'Juliana Farías',
    alias_match: null,
  },
  evidence: null,
  payload: {
    transaction_type: 'purchase',
    amount: 10000,
    currency: 'ARS',
    category: 'Alimentos',
    description: 'Juliana Farías',
    is_want: null,
    is_recurring: false,
    is_extraordinary: false,
    payment_method: 'CREDIT',
    account_id: null,
    card_id: '10000000-0000-4000-8000-000000000002',
    date: '2026-10-22',
    installments: 1,
  },
  decisions: {
    categoryReviewed: true,
    operationReviewed: true,
    warningsReviewed: true,
  },
  categoryOrigin: 'user',
  duplicates: 'clear',
  selected: true,
})

describe('pending merchant memory persistence', () => {
  it('serializes enabled memory from a confirmed draft', () => {
    const pending = pendingMerchantMemoryFromDraft(draft(), {
      enabled: true,
      mode: 'existing',
      name: 'Juliana',
      profileId: 'profile-1',
    })
    expect(pending).toMatchObject({
      detectedAlias: 'Juliana Farías',
      description: 'Juliana Farías',
      memory: { enabled: true, mode: 'existing', profileId: 'profile-1' },
    })
  })

  it('ignores disabled memory', () => {
    expect(
      pendingMerchantMemoryFromDraft(draft(), {
        enabled: false,
        mode: 'new',
        name: '',
        profileId: '',
      })
    ).toBeNull()
  })

  it('rejects corrupt persisted payloads without throwing', () => {
    expect(parsePendingMerchantMemory({ memory: { enabled: false } })).toBeNull()
    expect(parsePendingMerchantMemory('not-json')).toBeNull()
  })

  it('ignores receiptId envelopes from inbox responses', () => {
    expect(
      parsePendingMerchantMemory({
        receiptId: 'r-1',
        ...pendingMerchantMemoryFromDraft(draft(), {
          enabled: true,
          mode: 'new',
          name: 'Pollería',
          profileId: '',
        })!,
      })
    ).toBeTruthy()
  })

  it('builds a retry draft that only drives alias memory', () => {
    const pending = pendingMerchantMemoryFromDraft(draft(), {
      enabled: true,
      mode: 'new',
      name: 'Pollería',
      profileId: '',
    })!
    const retry = retryDraftFromPending(pending, draft().receipt.id)
    expect(retry.confirmed).toBe(true)
    expect(retry.payload.amount).toBe(0)
    expect(retry.receipt.detected_alias).toBe('Juliana Farías')
  })

  it('detects a missing pending_merchant_memory column', () => {
    expect(
      isMissingPendingMerchantMemoryColumn({
        code: '42703',
        message: 'column pending_merchant_memory does not exist',
      })
    ).toBe(true)
    expect(isMissingPendingMerchantMemoryColumn({ code: 'XX000' })).toBe(false)
  })
})
