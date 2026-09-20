import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  new URL(
    '../components/settings/MercadoPagoSettingsCard.tsx',
    import.meta.url
  ),
  'utf8'
)

describe('Mercado Pago review UI contract', () => {
  it('keeps Settings focused on connection and routes review to the dedicated inbox', () => {
    expect(source).toContain("href=\"/mercadopago/review\"")
    expect(source).not.toContain("/api/integrations/mercadopago/movements")
    expect(source).not.toContain('confirm-expense')
    expect(source).not.toContain('<Modal')
  })
})
