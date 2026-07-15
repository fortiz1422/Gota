import { describe, expect, it } from 'vitest'
import {
  coverageFamilyDisplay,
  coverageStateDisplay,
  maskSignalOccurrence,
  maskSignalText,
  nextSignalTab,
} from '../signal-center-display'
import type { SignalOccurrence } from '../signal-center'

describe('maskSignalText', () => {
  it('oculta montos ARS, USD y prefijados con signo peso', () => {
    const copy = 'Te faltan $ 120.000; tenés ARS 45.500 y USD 30,25 (US$ 12.50).'

    expect(maskSignalText(copy, false)).toBe(
      'Te faltan •••; tenés ••• y ••• (•••).',
    )
  })

  it('conserva porcentajes y números que no están marcados como montos', () => {
    expect(maskSignalText('Vas 18% arriba al día 15 y quedan 4 días.', false)).toBe(
      'Vas 18% arriba al día 15 y quedan 4 días.',
    )
  })

  it('no modifica el copy cuando los montos están visibles', () => {
    const copy = 'Disponible: $ 250.000'
    expect(maskSignalText(copy, true)).toBe(copy)
  })
})

describe('labels de cobertura', () => {
  it('expone las diez familias con nombre y descripción en español', () => {
    const families = [
      'liquidity',
      'cards',
      'budget',
      'pace',
      'unusual',
      'installments',
      'wants',
      'goals',
      'income',
      'subscriptions',
    ] as const

    for (const family of families) {
      const display = coverageFamilyDisplay(family)
      expect(display.label.length).toBeGreaterThan(0)
      expect(display.description.length).toBeGreaterThan(12)
    }
  })

  it('traduce los cuatro estados sin depender solo de color', () => {
    expect(coverageStateDisplay('active').label).toBe('Activa')
    expect(coverageStateDisplay('learning').label).toBe('Aprendiendo')
    expect(coverageStateDisplay('needs_setup').label).toBe('Necesita configuración')
    expect(coverageStateDisplay('not_applicable').label).toBe('No aplica')
  })
})

describe('maskSignalOccurrence', () => {
  it('oculta montos en todo el contenido presentacional sin mutar la señal', () => {
    const signal: SignalOccurrence = {
      id: 'sig_test',
      occurrenceKey: 'sig_test',
      version: 'sigv_test',
      kind: 'liquidity_watch',
      domain: 'liquidity',
      severity: 'risk',
      priority: 1,
      title: 'Faltan $ 10.000',
      summary: 'Saldo ARS 20.000',
      message: 'Necesitás USD 30',
      evidence: [{ label: 'Deuda $ 40.000', value: 'ARS 40.000' }],
      caveats: ['Sin US$ 50'],
      dataQuality: 'ok',
      validUntil: '2026-07-18',
      action: {
        type: 'ask',
        label: 'Preguntar por $ 10.000',
        question: '¿Cómo consigo USD 30?',
      },
      askQuestion: '¿Cómo consigo USD 30?',
      source: 'candidate',
    }

    const masked = maskSignalOccurrence(signal, false)

    expect(JSON.stringify(masked)).not.toContain('$')
    expect(JSON.stringify(masked)).not.toMatch(/\b(?:ARS|USD)\b/)
    expect(masked.message).toBe('Necesitás •••')
    expect(signal.message).toBe('Necesitás USD 30')
  })
})

describe('nextSignalTab', () => {
  it('permite recorrer tabs con flechas, Home y End', () => {
    expect(nextSignalTab('now', 'ArrowRight')).toBe('coverage')
    expect(nextSignalTab('coverage', 'ArrowRight')).toBe('now')
    expect(nextSignalTab('now', 'ArrowLeft')).toBe('coverage')
    expect(nextSignalTab('coverage', 'Home')).toBe('now')
    expect(nextSignalTab('now', 'End')).toBe('coverage')
  })

  it('ignora teclas que no navegan tabs', () => {
    expect(nextSignalTab('now', 'Enter')).toBeNull()
  })
})
