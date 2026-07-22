import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_VALUE = process.env.NEXT_PUBLIC_FF_WEB_PANEL_BRIEF_V1

async function loadFlag(value?: string) {
  vi.resetModules()
  if (value === undefined) delete process.env.NEXT_PUBLIC_FF_WEB_PANEL_BRIEF_V1
  else process.env.NEXT_PUBLIC_FF_WEB_PANEL_BRIEF_V1 = value
  return import('../flags')
}

afterEach(() => {
  vi.resetModules()
  if (ORIGINAL_VALUE === undefined) delete process.env.NEXT_PUBLIC_FF_WEB_PANEL_BRIEF_V1
  else process.env.NEXT_PUBLIC_FF_WEB_PANEL_BRIEF_V1 = ORIGINAL_VALUE
})

describe('FF_WEB_PANEL_BRIEF_V1', () => {
  it('queda apagada por defecto', async () => {
    expect((await loadFlag()).FF_WEB_PANEL_BRIEF_V1).toBe(false)
  })

  it("se activa únicamente con 'true'", async () => {
    expect((await loadFlag('true')).FF_WEB_PANEL_BRIEF_V1).toBe(true)
    expect((await loadFlag('false')).FF_WEB_PANEL_BRIEF_V1).toBe(false)
    expect((await loadFlag('TRUE')).FF_WEB_PANEL_BRIEF_V1).toBe(false)
  })
})
