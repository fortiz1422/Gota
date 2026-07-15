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
          signal_kind: 'card_due',
          severity: 'risk',
          source: 'signals_center',
        },
        'signals_signal_opened',
      ),
    ).toEqual({
      signal_kind: 'card_due',
      severity: 'risk',
      source: 'signals_center',
    })
  })

  it.each([
    [
      'signals_bell_clicked',
      { surface: 'home', has_unread: true },
    ],
    [
      'signals_center_opened',
      { source: 'bell', surface: 'signals_center', has_unread: false },
    ],
    [
      'signals_signal_opened',
      { signal_kind: 'card_due', severity: 'risk', source: 'now' },
    ],
    [
      'signals_coverage_opened',
      {
        coverage_id: 'coverage_cards',
        coverage_state: 'active',
        source: 'coverage',
      },
    ],
    [
      'signals_action_clicked',
      {
        signal_kind: 'card_due',
        action_type: 'open_card',
        source: 'signal_detail',
      },
    ],
  ] as const)('preserves the allowlisted properties for %s', (eventName, properties) => {
    expect(sanitizeEventProperties(properties, eventName)).toEqual(properties)
  })
})
