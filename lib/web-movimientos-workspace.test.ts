import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Account, Card } from '@/types/database'
import type { ApiMovement } from '@/components/dashboard/desktop/movimientos-data'
import { WebMovimientosWorkspace } from '@/components/dashboard/desktop/WebMovimientosWorkspace'

const accounts = [
  { id: 'nacion', name: 'Nación', type: 'bank', is_primary: true },
  { id: 'mp', name: 'Mercado Pago', type: 'digital', is_primary: false },
] as Account[]

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
] as ApiMovement[]

describe('WebMovimientosWorkspace', () => {
  it('renders a bounded ledger and account context without dashboard KPI cards', () => {
    const html = renderToStaticMarkup(
      createElement(WebMovimientosWorkspace, {
        accounts,
        cards: [] as Card[],
        accountBalances: [
          { id: 'nacion', name: 'Nación', type: 'bank', is_primary: true, saldo: 1_820_500 },
          { id: 'mp', name: 'Mercado Pago', type: 'digital', is_primary: false, saldo: 584_600 },
        ],
        selectedMonth: '2026-07',
        viewCurrency: 'ARS',
        hidden: false,
        initialMovements: movements,
        today: '2026-07-23',
        onOpenSettings: () => undefined,
      }),
    )

    expect(html).toContain('data-web-movimientos-workspace="true"')
    expect(html).toContain('data-web-movement-ledger="true"')
    expect(html).toContain('data-web-account-context="true"')
    expect(html).toContain('web-account-rail')
    expect(html).toContain('Todas las cuentas')
    expect(html).toContain('Carrefour')
    expect(html).toContain('Alimentos · Nación')
    expect(html).toContain('Nuevo movimiento')
    expect(html).not.toContain('Gastos del mes')
    expect(html).not.toContain('Margen')
  })
})
