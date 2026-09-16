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
  it('uses the canonical Modal as the single review header owner', () => {
    expect(source).toContain("import { Modal } from '@/components/ui/Modal'")
    expect(source).toContain(
      '<Modal open onClose={closeReview} title="Confirmar gasto">'
    )
    expect(source).not.toContain('id="confirm-expense-title"')
    expect(source).toContain('!description.trim()')
    expect(source).toContain('!category')
    expect(source).toContain('!accountId')
    expect(source).not.toContain('fixed inset-0 z-50')
  })
})
