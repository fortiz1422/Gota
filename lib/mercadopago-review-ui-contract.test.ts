import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildConfirmExpensePayload } from '@/lib/mercadopago/review'

const source = readFileSync(
  new URL(
    '../components/settings/MercadoPagoSettingsCard.tsx',
    import.meta.url
  ),
  'utf8'
)
const parsePreviewSource = readFileSync(new URL('../components/dashboard/ParsePreview.tsx', import.meta.url), 'utf8')
const reviewClientSource = readFileSync(new URL('../components/mercadopago/MercadoPagoReviewClient.tsx', import.meta.url), 'utf8')

describe('Mercado Pago review UI contract', () => {
  it('keeps Settings focused on connection and routes review to the dedicated inbox', () => {
    expect(source).toContain("href=\"/mercadopago/review\"")
    expect(source).not.toContain("/api/integrations/mercadopago/movements")
    expect(source).not.toContain('confirm-expense')
    expect(source).not.toContain('<Modal')
  })

  it('uses ParsePreview with opt-in immutable provider evidence for MP confirmation', () => {
    expect(reviewClientSource).toContain('<ParsePreview')
    expect(reviewClientSource).toContain('immutableProviderEvidence')
    expect(reviewClientSource).toContain('aliasSource="mercadopago"')
    expect(parsePreviewSource).toContain('immutableProviderEvidence?: boolean')
    expect(parsePreviewSource).toContain('readOnly={immutableProviderEvidence}')
  })

  it('keeps the MP browser payload exact and narrow', () => {
    expect(buildConfirmExpensePayload({
      description: ' Shell ', category: 'Alimentos', isWant: false, accountId: 'account-1',
    })).toEqual({ description: 'Shell', category: 'Alimentos', isWant: false, accountId: 'account-1' })
  })

  it('keeps evidence-only detail free of a confirmation CTA', () => {
    expect(reviewClientSource).toContain('open={selected !== null && !isReviewableMercadoPagoExpense(selected)}')
    expect(reviewClientSource).toContain('Esta operación todavía no se puede confirmar.')
  })
})
