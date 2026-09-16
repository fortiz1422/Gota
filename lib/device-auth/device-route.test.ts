import { describe, expect, it } from 'vitest'
import { isIndependentlyAuthenticatedPath } from '@/proxy'

describe('isIndependentlyAuthenticatedPath', () => {
  it('permite sólo los endpoints con autenticación independiente', () => {
    expect(isIndependentlyAuthenticatedPath('/api/device/v1/snapshot')).toBe(true)
    expect(isIndependentlyAuthenticatedPath('/api/shortcut/v1/receipts')).toBe(true)
    expect(isIndependentlyAuthenticatedPath('/api/integrations/mercadopago/settlement-probe')).toBe(true)

    expect(isIndependentlyAuthenticatedPath('/api/integrations/mercadopago/settlement-probe/')).toBe(false)
    expect(isIndependentlyAuthenticatedPath('/api/integrations/mercadopago/settlement-probe/other')).toBe(false)
    expect(isIndependentlyAuthenticatedPath('/api/integrations/mercadopago/settlement-probes')).toBe(false)
    expect(isIndependentlyAuthenticatedPath('/api/device/v1/other')).toBe(false)
    expect(isIndependentlyAuthenticatedPath('/api/shortcut/v1/other')).toBe(false)
    expect(isIndependentlyAuthenticatedPath('/api/dashboard')).toBe(false)
    expect(isIndependentlyAuthenticatedPath('/api/device/v2/snapshot')).toBe(false)
  })
})
