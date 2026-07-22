import { describe, expect, it } from 'vitest'
import type { SignalCenterModel, SignalOccurrence } from '@/lib/intelligence/signal-center'
import { buildMoneyEquation, buildWebBrief, describeHorizonEvent, isWithinRollingHorizon } from './panel-model'

function signal(overrides: Partial<SignalOccurrence> = {}): SignalOccurrence {
  return {
    id: 'sig-1',
    occurrenceKey: 'opaque-key',
    version: 'opaque-version',
    kind: 'budget_acceleration',
    domain: 'budget',
    severity: 'watch',
    priority: 320,
    title: 'Supermercado va camino a pasarse',
    summary: 'Usaste 80% con 50% del mes transcurrido',
    message: 'Detalle',
    evidence: [],
    caveats: [],
    dataQuality: 'ok',
    validUntil: '2026-07-31',
    action: { type: 'navigate', label: 'Ver presupuesto', href: '/analytics?view=budget' },
    askQuestion: null,
    source: 'candidate',
    ...overrides,
  }
}

function center(signals: SignalOccurrence[], quality: SignalCenterModel['dataQuality'] = 'ok'): SignalCenterModel {
  return {
    generatedAt: '2026-07-21T12:00:00.000Z',
    month: '2026-07',
    currency: 'ARS',
    dataQuality: quality,
    signals,
    coverage: [],
  }
}

describe('buildMoneyEquation', () => {
  it('mantiene una ecuación reconciliable y usa Disponible Libre real', () => {
    expect(buildMoneyEquation({ saldoVivo: 1_000, disponibleReal: 600, disponibleLibre: 500 })).toEqual({
      saldoVivo: 1_000,
      disponibleReal: 600,
      causedCardCommitments: 400,
      goalCommitments: 100,
      disponibleLibre: 500,
      reconciles: true,
    })
  })

  it('no oculta inconsistencias de origen mediante clamps silenciosos', () => {
    expect(buildMoneyEquation({ saldoVivo: 500, disponibleReal: 600, disponibleLibre: 550 }).reconciles).toBe(false)
  })
})

describe('buildWebBrief', () => {
  it('selecciona una única occurrence risk/watch y conserva su acción', () => {
    const risk = signal({ severity: 'risk', title: 'El saldo no cubre lo que viene' })
    const brief = buildWebBrief({ model: center([risk, signal()]), historical: false })

    expect(brief.status).toBe('risk')
    expect(brief.title).toBe(risk.title)
    expect(brief.primarySignal?.version).toBe(risk.version)
    expect(brief.secondaryCount).toBe(1)
  })

  it('no convierte una señal positiva en Action Slot', () => {
    const positive = signal({ severity: 'positive', title: 'Vas mejor' })
    const brief = buildWebBrief({ model: center([positive]), historical: false })

    expect(brief.status).toBe('calm')
    expect(brief.primarySignal).toBeNull()
  })

  it('declara learning con cobertura parcial y sin señal accionable', () => {
    expect(buildWebBrief({ model: center([], 'partial'), historical: false }).status).toBe('learning')
  })

  it('no inserta señales actuales dentro del contenido histórico', () => {
    const brief = buildWebBrief({ model: center([signal()]), historical: true })

    expect(brief.status).toBe('historical')
    expect(brief.primarySignal).toBeNull()
  })
})

describe('describeHorizonEvent', () => {
  it('limita la ventana móvil a hoy + 30 días inclusive', () => {
    expect(isWithinRollingHorizon('2026-07-21', '2026-07-21')).toBe(true)
    expect(isWithinRollingHorizon('2026-08-20', '2026-07-21')).toBe(true)
    expect(isWithinRollingHorizon('2026-08-21', '2026-07-21')).toBe(false)
    expect(isWithinRollingHorizon('2026-07-20', '2026-07-21')).toBe(false)
  })

  it('marca vencimientos de tarjeta como ya contemplados en Disponible Real', () => {
    expect(describeHorizonEvent({ kind: 'due', estimated: false })).toMatchObject({
      scope: 'included',
      label: 'Ya descontado de Disponible Real',
    })
  })

  it('marca ingresos e instrumentos como futuros sin mejorar la caja de hoy', () => {
    expect(describeHorizonEvent({ kind: 'income', estimated: true }).scope).toBe('estimated')
    expect(describeHorizonEvent({ kind: 'instrument', estimated: false }).scope).toBe('future')
  })

  it('distingue una suscripción estimada de una cuota ya programada', () => {
    expect(describeHorizonEvent({ kind: 'subscription', estimated: true, paymentMethod: 'CREDIT' })).toEqual({
      scope: 'estimated',
      label: 'Generará compromiso en la tarjeta',
    })
    expect(describeHorizonEvent({ kind: 'installment', estimated: false })).toEqual({
      scope: 'future',
      label: 'Compromiso programado · no es salida de caja hoy',
    })
  })
})
