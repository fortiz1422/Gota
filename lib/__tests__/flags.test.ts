import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_SIGNALS_VALUE = process.env.NEXT_PUBLIC_FF_SIGNALS_CENTER_V1
const ORIGINAL_ANALYTICS_VALUE = process.env.NEXT_PUBLIC_FF_ANALYTICS_WORKSPACE_V1

async function loadFlags({ signals, analytics }: { signals?: string; analytics?: string } = {}) {
  vi.resetModules()
  if (signals === undefined) delete process.env.NEXT_PUBLIC_FF_SIGNALS_CENTER_V1
  else process.env.NEXT_PUBLIC_FF_SIGNALS_CENTER_V1 = signals
  if (analytics === undefined) delete process.env.NEXT_PUBLIC_FF_ANALYTICS_WORKSPACE_V1
  else process.env.NEXT_PUBLIC_FF_ANALYTICS_WORKSPACE_V1 = analytics
  return import('../flags')
}

afterEach(() => {
  vi.resetModules()
  if (ORIGINAL_SIGNALS_VALUE === undefined) delete process.env.NEXT_PUBLIC_FF_SIGNALS_CENTER_V1
  else process.env.NEXT_PUBLIC_FF_SIGNALS_CENTER_V1 = ORIGINAL_SIGNALS_VALUE
  if (ORIGINAL_ANALYTICS_VALUE === undefined) delete process.env.NEXT_PUBLIC_FF_ANALYTICS_WORKSPACE_V1
  else process.env.NEXT_PUBLIC_FF_ANALYTICS_WORKSPACE_V1 = ORIGINAL_ANALYTICS_VALUE
})

describe('FF_SIGNALS_CENTER_V1', () => {
  it('queda apagada por defecto', async () => {
    const flags = await loadFlags()
    expect(flags.FF_SIGNALS_CENTER_V1).toBe(false)
  })

  it("se activa únicamente con 'true'", async () => {
    expect((await loadFlags({ signals: 'true' })).FF_SIGNALS_CENTER_V1).toBe(true)
    expect((await loadFlags({ signals: 'false' })).FF_SIGNALS_CENTER_V1).toBe(false)
  })
})

describe('FF_ANALYTICS_WORKSPACE_V1', () => {
  it('queda apagada por defecto', async () => {
    expect((await loadFlags()).FF_ANALYTICS_WORKSPACE_V1).toBe(false)
  })

  it("se activa únicamente con 'true'", async () => {
    expect((await loadFlags({ analytics: 'true' })).FF_ANALYTICS_WORKSPACE_V1).toBe(true)
    expect((await loadFlags({ analytics: 'false' })).FF_ANALYTICS_WORKSPACE_V1).toBe(false)
    expect((await loadFlags({ analytics: 'TRUE' })).FF_ANALYTICS_WORKSPACE_V1).toBe(false)
  })
})
