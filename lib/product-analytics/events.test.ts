import { describe, expect, it } from 'vitest'
import { isProductEventName, sanitizeEventProperties } from './events'

describe('Signals product analytics events', () => {
  it.each([
    'signals_bell_clicked',
    'signals_center_opened',
    'signals_signal_opened',
    'signals_coverage_opened',
    'signals_action_clicked',
  ])('accepts %s as a registered product event', (eventName) => {
    expect(isProductEventName(eventName)).toBe(true)
  })

  it('removes financial data and PII from Signals events by default', () => {
    expect(
      sanitizeEventProperties(
        {
          amount: 120_000,
          balance: 450_000,
          category: 'Alquiler',
          title: 'La tarjeta vence mañana',
          message: 'Pagá $120.000 para evitar intereses',
          description: 'Detalle financiero privado',
          evidence: 'Cuenta terminada en 1234',
          email: 'persona@example.com',
          account_id: 'account-1234',
          user_document: '20-12345678-9',
          raw_payload: 'contenido financiero no clasificado',
          signal_kind: 'upcoming_card_due',
          severity: 'risk',
          source: 'center',
        },
        'signals_signal_opened',
      ),
    ).toEqual({
      signal_kind: 'upcoming_card_due',
      severity: 'risk',
      source: 'center',
    })
  })

  it.each([
    [
      'signals_bell_clicked',
      { surface: 'home', has_unread: true },
    ],
    [
      'signals_center_opened',
      { source: 'bell', surface: 'home', has_unread: false },
    ],
    [
      'signals_signal_opened',
      { signal_kind: 'upcoming_card_due', severity: 'risk', source: 'center' },
    ],
    [
      'signals_coverage_opened',
      {
        coverage_id: 'cards',
        coverage_state: 'active',
        source: 'center',
      },
    ],
    [
      'signals_action_clicked',
      {
        signal_kind: 'upcoming_card_due',
        action_type: 'navigate',
        source: 'center',
      },
    ],
  ] as const)('preserves the allowlisted properties for %s', (eventName, properties) => {
    expect(sanitizeEventProperties(properties, eventName)).toEqual(properties)
  })

  it('drops untrusted values even when their property names are allowlisted', () => {
    expect(
      sanitizeEventProperties(
        {
          signal_kind: 'saldo ARS 500000 de Juan',
          severity: 'risk; persona@example.com',
          source: 'center / cuenta 1234',
          action_type: 'navigate',
        },
        'signals_action_clicked',
      ),
    ).toEqual({ action_type: 'navigate' })
  })
})

describe('Analysis workspace product analytics events', () => {
  it('accepts the section selection event', () => {
    expect(isProductEventName('analysis_section_selected')).toBe(true)
  })

  it('only preserves categorical allowlisted properties', () => {
    expect(
      sanitizeEventProperties(
        {
          section: 'budget',
          source: 'workspace_tabs',
          month: '2026-07',
          category: 'Supermercado',
          amount: 120_000,
        },
        'analysis_section_selected',
      ),
    ).toEqual({ section: 'budget', source: 'workspace_tabs' })
  })

  it('drops untrusted section and source values', () => {
    expect(
      sanitizeEventProperties(
        { section: 'meta Viaje', source: 'deep_link con datos' },
        'analysis_section_selected',
      ),
    ).toEqual({})
  })
})
