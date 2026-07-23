import { describe, expect, it } from 'vitest'
import type { Account, Card } from '@/types/database'
import type { ApiMovement } from '@/components/dashboard/desktop/movimientos-data'
import {
  buildAccountActivityCounts,
  buildWebMovementRows,
  filterWebMovementRows,
  groupWebMovementRows,
} from './web-movimientos-model'

const accounts = [
  { id: 'nacion', name: 'Nación', type: 'bank', is_primary: true },
  { id: 'mp', name: 'Mercado Pago', type: 'digital', is_primary: false },
] as Account[]

const cards = [
  { id: 'visa', name: 'Visa', account_id: 'nacion' },
] as Card[]

const movements = [
  {
    kind: 'expense',
    data: {
      id: 'expense-1',
      description: 'Carrefour',
      category: 'Alimentos',
      amount: 48_520,
      currency: 'ARS',
      payment_method: 'DEBIT',
      account_id: 'nacion',
      card_id: null,
      date: '2026-07-23',
      created_at: '2026-07-23T12:00:00Z',
    },
  },
  {
    kind: 'expense',
    data: {
      id: 'expense-2',
      description: 'Mercado Libre',
      category: 'Tecnología',
      amount: 86_900,
      currency: 'ARS',
      payment_method: 'CREDIT',
      account_id: null,
      card_id: 'visa',
      date: '2026-07-22',
      created_at: '2026-07-22T12:00:00Z',
    },
  },
  {
    kind: 'income',
    data: {
      id: 'income-1',
      description: 'Sueldo',
      category: 'salary',
      amount: 1_850_000,
      currency: 'ARS',
      account_id: 'nacion',
      date: '2026-07-23',
      created_at: '2026-07-23T11:00:00Z',
    },
  },
  {
    kind: 'transfer',
    data: {
      id: 'transfer-1',
      from_account_id: 'nacion',
      to_account_id: 'mp',
      amount_from: 120_000,
      amount_to: 120_000,
      currency_from: 'ARS',
      currency_to: 'ARS',
      date: '2026-07-23',
      note: 'Para gastos diarios',
      created_at: '2026-07-23T10:00:00Z',
    },
  },
  {
    kind: 'yield',
    data: {
      id: 'yield-1',
      account_id: 'nacion',
      accountName: 'Nación',
      amount: 2_430,
      currency: 'ARS',
      date: '2026-07-21',
      dayCount: 3,
      actualCount: 3,
      estimatedCount: 0,
      differenceCount: 0,
    },
  },
] as ApiMovement[]

describe('web movimientos model', () => {
  it('normalizes every movement kind with account context and finance semantics', () => {
    const rows = buildWebMovementRows(movements, accounts, cards)

    expect(rows.map((row) => row.id)).toEqual([
      'expense:expense-1',
      'expense:expense-2',
      'income:income-1',
      'transfer:transfer-1',
      'yield:yield-1',
    ])
    expect(rows[0]).toMatchObject({
      title: 'Carrefour',
      secondary: 'Alimentos · Nación',
      accountIds: ['nacion'],
      signedAmount: -48_520,
      tone: 'expense',
    })
    expect(rows[1]).toMatchObject({
      secondary: 'Tecnología · Visa',
      accountIds: ['nacion'],
      signedAmount: -86_900,
    })
    expect(rows[2]).toMatchObject({ signedAmount: 1_850_000, tone: 'income' })
    expect(rows[3]).toMatchObject({
      title: 'Transferencia',
      secondary: 'Nación → Mercado Pago',
      accountIds: ['nacion', 'mp'],
      tone: 'transfer',
    })
    expect(rows[4]).toMatchObject({
      secondary: 'Nación · 3 días reales',
      accountIds: ['nacion'],
      signedAmount: 2_430,
      tone: 'yield',
    })
  })

  it('filters by type, both sides of a transfer, and normalized search text', () => {
    const rows = buildWebMovementRows(movements, accounts, cards)

    expect(filterWebMovementRows(rows, { type: 'transfer', accountId: 'mp', query: '' })).toHaveLength(1)
    expect(filterWebMovementRows(rows, { type: 'all', accountId: 'nacion', query: 'tecnologia' }).map((row) => row.id)).toEqual([
      'expense:expense-2',
    ])
    expect(filterWebMovementRows(rows, { type: 'income', accountId: null, query: 'NACIÓN' }).map((row) => row.id)).toEqual([
      'income:income-1',
    ])
  })

  it('groups newest dates first and counts account activity without double-counting rows', () => {
    const rows = buildWebMovementRows(movements, accounts, cards)
    const groups = groupWebMovementRows(rows, '2026-07-23')

    expect(groups.map((group) => group.label)).toEqual([
      'Hoy · 23 de julio',
      'Ayer · 22 de julio',
      'Martes · 21 de julio',
    ])
    expect(buildAccountActivityCounts(rows)).toEqual({ nacion: 5, mp: 1 })
  })
})
