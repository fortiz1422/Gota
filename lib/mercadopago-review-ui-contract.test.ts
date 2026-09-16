import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../components/settings/MercadoPagoSettingsCard.tsx', import.meta.url), 'utf8')

describe('Mercado Pago review UI contract', () => {
  it('uses the canonical Modal instead of an ad-hoc fixed review shell', () => {
    expect(source).toContain("import { Modal } from '@/components/ui/Modal'")
    expect(source).toContain('<Modal open onClose={closeReview}>')
    expect(source).not.toContain('fixed inset-0 z-50')
  })
})