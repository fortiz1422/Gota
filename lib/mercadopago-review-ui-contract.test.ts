import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildConfirmExpensePayload } from '@/lib/mercadopago/review'
import { shouldOpenAccountManagement } from '@/components/web/settings/WebSettingsPage'

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
      description: ' Shell ', category: 'Alimentos', isWant: false, expectedLinkedAccountId: 'account-1', expectedLinkedAccountVersion: 3,
    })).toEqual({ description: 'Shell', category: 'Alimentos', isWant: false, expectedLinkedAccountId: 'account-1', expectedLinkedAccountVersion: 3 })
    expect(source).toContain('Cuenta que representa tu saldo de Mercado Pago')
    expect(reviewClientSource).not.toContain('accountId: payload.account_id')
  })

  it('keeps the normal inbox flat and gates bulk selection behind Seleccionar', () => {
    expect(reviewClientSource).toContain('onEnterSelection')
    expect(reviewClientSource).toContain('onCancelSelection')
    expect(reviewClientSource).toContain('selectionMode && <label className="-my-2 -ml-2 flex min-h-11 min-w-11')
    expect(reviewClientSource).toContain('type-amount-sm shrink-0 whitespace-nowrap text-text-primary')
    expect(reviewClientSource).toContain('Hasta esta fecha (inclusive)')
    expect(reviewClientSource).toContain('Se desestiman sólo las operaciones seleccionadas. No se registran como gastos.')
    expect(reviewClientSource).not.toContain('La selección pertenece a esta carga del servidor')
  })

  it('opens account management from the explicit Settings deep-link contract', () => {
    expect(source).toContain('href="/web/settings?section=cuentas"')
    expect(shouldOpenAccountManagement('cuentas')).toBe(true)
    expect(shouldOpenAccountManagement('tarjetas')).toBe(false)
  })

  it('offers destructive dismissal from both review detail states', () => {
    expect(reviewClientSource.match(/Desestimar operación/g)?.length).toBeGreaterThanOrEqual(2)
    expect(reviewClientSource).toContain('Todavía no disponible para registrar')
  })
})
