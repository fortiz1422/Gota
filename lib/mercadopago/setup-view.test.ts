import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MercadoPagoSetupView, type MercadoPagoSetupState } from '@/components/settings/MercadoPagoSetupCard'
const render = (state: MercadoPagoSetupState) => renderToStaticMarkup(React.createElement(MercadoPagoSetupView, { state, preset: '30d', setPreset: () => undefined, busy: false, error: null, onStart: () => undefined, onResume: () => undefined, onDisconnect: () => undefined }))
describe('setup user contract', () => {
  it('offers only three initial periods and discloses review before ledger posting', () => {
    const html = render({ available: true, state: 'connected', initialImport: { status: 'not_started', preset: null, startedAt: null, completedAt: null } })
    expect(html).toContain('Desde hoy')
    expect(html).toContain('Últimos 30 días')
    expect(html).toContain('Últimos 90 días')
    expect(html).toContain('todavía requieren revisión')
    expect(html).not.toContain('Payments Search')
    expect(html).not.toContain('Settlement')
    expect(html).not.toContain('Sincronizar ahora')
    expect(html).not.toContain('Período de consulta')
    expect(html).toContain('saldo inicial queda pendiente')
  })
  it('uses Argentine dates and retains imported movements when disconnecting', () => {
    const html = render({ available: true, state: 'connected', enabled: true, accountName: 'Mercado Pago', initialImport: { status: 'running', preset: '30d', startedAt: '2026-09-30T23:00:00Z', completedAt: null } })
    expect(html).toContain('30/9/2026')
    expect(html).toContain('ya registrados se conservan')
    expect(html).toContain('Opciones avanzadas')
    expect(html).not.toContain('¿Desde cuándo')
  })
  it('requires OAuth again after disconnect', () => {
    const html = render({ available: true, state: 'needs_reconnect' })
    expect(html).toContain('Reconectar Mercado Pago')
    expect(html).not.toContain('Continuar')
  })
})
