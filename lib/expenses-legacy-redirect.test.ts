import { describe, expect, it } from 'vitest'
import { expensesToMovimientosHref } from '@/app/(dashboard)/expenses/page'

describe('expenses legacy redirect', () => {
  it('preserves month and category on movimientos', () => {
    expect(
      expensesToMovimientosHref({ month: '2026-03', category: 'Alimentos' }),
    ).toBe('/movimientos?month=2026-03&categoria=Alimentos')
  })

  it('drops pagination, payment method and expense-only flags', () => {
    expect(
      expensesToMovimientosHref({
        month: '2026-01',
        page: '2',
        payment_method: 'CREDIT',
        is_recurring: 'true',
        is_extraordinary: 'false',
      }),
    ).toBe('/movimientos?month=2026-01')
  })
})
