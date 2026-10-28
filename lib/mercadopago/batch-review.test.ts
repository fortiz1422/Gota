import { describe, expect, it, vi } from 'vitest'
import type { Card } from '@/types/database'
import {
  batchBlocker,
  batchEvidence,
  buildBatchBody,
  cardEvidenceKey,
  createBatchDraft,
  submitBatch,
} from './batch-review'
import {
  getDisplayExpenseDescription,
  type MercadoPagoMovement,
} from './review'
const movement: MercadoPagoMovement = {
  candidateId: 'one',
  occurredAt: '2026-10-23T12:00:00Z',
  balanceOccurredAt: null,
  amount: { value: 1192.99, currency: 'ARS' },
  description: null,
  statementDescriptor: null,
  reviewStatus: 'pending',
  kind: 'expense',
  direction: 'outflow',
  installments: 1,
  operation: {
    type: 'regular_payment',
    status: 'approved',
    statusDetail: 'accredited',
  },
  summary: { refunded: 0, totalPaid: 1192.99 },
  fundingSource: {
    kind: 'card',
    brand: 'master',
    lastFour: '8215',
    cardType: 'credit',
  },
  cardType: 'credit',
  cardPurchaseEligible: true,
  balanceImpact: {
    observed: false,
    effect: 'unknown',
    amount: { value: null, currency: null },
  },
  reviewSnapshot: { fingerprint: 'a'.repeat(64), observations: [] },
}
const card = {
  id: 'card',
  name: 'Mastercard',
  last_four: '8215',
  archived: false,
} as Card
const link = { linkedAccountId: 'account', linkedAccountVersion: 2 }
const draft = () => ({
  ...createBatchDraft(movement, [card]),
  description: 'Peaje',
  category: 'Transporte',
})
const entry = (id: string) => ({
  candidateId: id,
  body: buildBatchBody(draft(), link),
})
const success = (entries: readonly ReturnType<typeof entry>[]) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({
      status: 'completed',
      remaining: 0,
      results: entries.map((entry) => ({
        candidateId: entry.candidateId,
        expenseId: 'expense',
      })),
    }),
  })

describe('MP batch intent and recovery', () => {
  it('uses provider descriptor when description is absent without inventing a merchant', () => {
    expect(
      getDisplayExpenseDescription({
        ...movement,
        statementDescriptor: 'MERPAGO*AUTOPISTAS',
      })
    ).toBe('AUTOPISTAS')
    expect(getDisplayExpenseDescription(movement)).toBe('')
    expect(
      getDisplayExpenseDescription({
        ...movement,
        description: 'Compra',
        statementDescriptor: 'OTHER',
      })
    ).toBe('Compra')
  })
  it('previews an observed debit using its actual balance amount and date', () => {
    const debit = {
      ...movement,
      cardPurchaseEligible: false,
      fundingSource: { kind: 'unknown' },
      balanceOccurredAt: '2026-10-22T15:00:00Z',
      balanceImpact: {
        observed: true,
        effect: 'debit' as const,
        amount: { value: -900, currency: 'ARS' },
      },
    }
    expect(batchEvidence(debit)).toEqual({
      amount: { value: -900, currency: 'ARS' },
      date: debit.balanceOccurredAt,
    })
  })
  it('never identifies funding by amount or missing last four; never auto-classifies', () => {
    expect(cardEvidenceKey(movement)).toBe('master:8215')
    expect(
      cardEvidenceKey({
        ...movement,
        fundingSource: { kind: 'card', brand: 'master' },
      })
    ).toBeNull()
    expect(
      cardEvidenceKey({
        ...movement,
        fundingSource: { kind: 'card', lastFour: '8215' },
      })
    ).toBeNull()
    expect(createBatchDraft(movement, [card])).toMatchObject({
      category: '',
      description: '',
      cardId: 'card',
    })
    expect(
      createBatchDraft(movement, [card, { ...card, id: 'other' }]).cardId
    ).toBe('')
  })
  it('blocks missing data, stale references, refunds, duplicates and stale snapshots', () => {
    expect(batchBlocker(draft(), [card], link)).toBeNull()
    expect(batchBlocker({ ...draft(), description: '' }, [card], link)).toBe(
      'Completá la descripción'
    )
    expect(batchBlocker({ ...draft(), category: '' }, [card], link)).toBe(
      'Elegí una categoría'
    )
    expect(batchBlocker(draft(), [{ ...card, archived: true }], link)).toBe(
      'Elegí una tarjeta activa'
    )
    expect(
      batchBlocker(
        { ...draft(), movement: { ...movement, reviewSnapshot: undefined } },
        [card],
        link
      )
    ).toBe('Actualizá la bandeja')
    for (const change of [
      { attention: 'possible_duplicate' as const },
      { summary: { refunded: 100, totalPaid: 1192.99 } },
      { reviewStatus: 'confirmed' as const },
    ]) {
      expect(
        batchBlocker(
          { ...draft(), movement: { ...movement, ...change } },
          [card],
          link
        )
      ).toBe('Requiere revisión individual')
    }
  })
  it('keeps amount/date immutable and uses the exact existing card/wallet endpoint contract', () => {
    expect(buildBatchBody(draft(), link)).toEqual({
      expectedCandidateFingerprint: 'a'.repeat(64),
      description: 'Peaje',
      category: 'Transporte',
      isWant: false,
      isRecurring: false,
      isExtraordinary: false,
      cardId: 'card',
      installments: 1,
    })
    const wallet = {
      ...draft(),
      movement: {
        ...movement,
        cardPurchaseEligible: false,
        fundingSource: { kind: 'mercadopago_balance' },
      },
    }
    expect(batchBlocker(wallet, [], null)).toBe(
      'Vinculá la cuenta de saldo MP en Configuración'
    )
    expect(buildBatchBody(wallet, link)).toMatchObject({
      expectedLinkedAccountId: 'account',
      expectedLinkedAccountVersion: 2,
    })
    expect(buildBatchBody(wallet, link)).not.toHaveProperty('cardId')
  })
  it('sends one bulk request and reports only the confirmed prefix after a conflict', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'stopped',
          results: [{ candidateId: 'one', expenseId: 'expense' }],
          remaining: 2,
          blocked: { status: 409 },
        }),
      })
    const confirmed = vi.fn()
    expect(
      await submitBatch(
        [entry('one'), entry('two'), entry('three')],
        send,
        confirmed
      )
    ).toEqual({ confirmed: 1, stopped: true, status: 409 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(confirmed).toHaveBeenCalledExactlyOnceWith('one')
  })
  it('bounds a stuck response including body reads without retrying', async () => {
    const send = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: () => new Promise(() => {}),
      })
    expect(await submitBatch([entry('one')], send, vi.fn(), 5)).toEqual({
      confirmed: 0,
      stopped: true,
      status: 0,
    })
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('rejects unordered or falsely complete responses before marking anything confirmed', async () => {
    for (const results of [
      [{ candidateId: 'two', expenseId: 'x' }],
      [{ candidateId: 'one', expenseId: 'x' }],
    ]) {
      const confirmed = vi.fn()
      const send = vi
        .fn()
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ status: 'completed', results, remaining: 1 }),
        })
      expect(
        await submitBatch([entry('one'), entry('two')], send, confirmed)
      ).toMatchObject({ stopped: true, confirmed: 0 })
      expect(confirmed).not.toHaveBeenCalled()
    }
  })
  it('stops on network ambiguity and malformed success without automatic retries', async () => {
    for (const send of [
      vi.fn().mockRejectedValue(new Error('timeout')),
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    ]) {
      expect(
        await submitBatch([entry('one'), entry('two')], send, vi.fn())
      ).toMatchObject({ confirmed: 0, stopped: true })
      expect(send).toHaveBeenCalledTimes(1)
    }
  })
  it('rejects empty or repeated identities and accepts a complete group of sixty', async () => {
    const send = vi.fn(success)
    await expect(
      submitBatch([entry('one'), entry('one')], send, vi.fn())
    ).rejects.toThrow('invalid_batch')
    await expect(submitBatch([], send, vi.fn())).rejects.toThrow(
      'invalid_batch'
    )
    expect(send).not.toHaveBeenCalled()
    expect(
      await submitBatch(
        Array.from({ length: 60 }, (_, n) => entry(String(n))),
        send,
        vi.fn()
      )
    ).toEqual({ confirmed: 60, stopped: false, status: 200 })
    expect(send).toHaveBeenCalledTimes(1)
  })
})
