import { describe, expect, it } from 'vitest'
import { SIGNALS_PREVIEW_STATES } from '../signals-preview-fixtures'

const EXPECTED_IDS = [
  'calm-covered',
  'learning-new-user',
  'watch-pace',
  'risk-card-liquidity',
  'multiple-signals',
  'needs-setup',
  'masked',
  'long-evidence',
]

describe('SIGNALS_PREVIEW_STATES', () => {
  it('mantiene los ocho escenarios determinísticos requeridos', () => {
    expect(SIGNALS_PREVIEW_STATES.map(({ id }) => id)).toEqual(EXPECTED_IDS)
  })

  it('usa el contrato real con diez familias y versiones opacas únicas', () => {
    for (const state of SIGNALS_PREVIEW_STATES) {
      expect(state.model.coverage).toHaveLength(10)
      expect(new Set(state.model.coverage.map(({ family }) => family)).size).toBe(10)
      expect(
        new Set(state.model.signals.map(({ version }) => version)).size,
      ).toBe(state.model.signals.length)
    }
  })

  it('expone masking como contexto de display y no como otro modelo financiero', () => {
    const masked = SIGNALS_PREVIEW_STATES.find(({ id }) => id === 'masked')
    expect(masked?.amountsVisible).toBe(false)
    expect(masked?.model.signals.some(({ message }) => message.includes('$'))).toBe(true)
  })
})
