import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  buildSubscriptionApplyPayload,
  buildSubscriptionBasePayload,
} from '@/lib/subscriptions/form-payload'

describe('mobile subscriptions surface contract', () => {
  it('uses the shared choice and confirmation contracts for nested decisions', () => {
    const source = readFileSync(new URL('../components/settings/SubscriptionBottomSheet.tsx', import.meta.url), 'utf8')
    expect(source).toContain('<ChoiceSurface')
    expect(source).toContain('data-subscription-scope')
    expect(source).toContain('<ConfirmationSurface')
    expect(source).toContain('data-subscription-archive')
    expect(source).not.toContain('<FullScreenSheet')
  })

  it('preserves the debit create payload and strips an inapplicable card', () => {
    expect(buildSubscriptionBasePayload({
      description: '  Netflix  ',
      category: 'Suscripciones',
      amount: 15999,
      currency: 'ARS',
      paymentMethod: 'DEBIT',
      cardId: 'card-unused',
      accountId: 'account-1',
      dayOfMonth: 12,
    })).toEqual({
      description: 'Netflix',
      category: 'Suscripciones',
      amount: 15999,
      currency: 'ARS',
      payment_method: 'DEBIT',
      card_id: null,
      account_id: 'account-1',
      day_of_month: 12,
    })
  })

  it('preserves the credit apply payload and its explicit review scope inputs', () => {
    expect(buildSubscriptionApplyPayload({
      description: 'Spotify',
      category: 'Suscripciones',
      amount: 8.5,
      currency: 'USD',
      paymentMethod: 'CREDIT',
      cardId: 'card-1',
      accountId: 'account-unused',
      dayOfMonth: 3,
    }, '2026-09-08T12:00:00.000Z', '2026-09')).toEqual({
      description: 'Spotify',
      category: 'Suscripciones',
      amount: 8.5,
      currency: 'USD',
      payment_method: 'CREDIT',
      card_id: 'card-1',
      account_id: null,
      day_of_month: 3,
      last_reviewed_at: '2026-09-08T12:00:00.000Z',
      month: '2026-09',
    })
  })
})