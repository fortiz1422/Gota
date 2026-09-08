import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
import { SettingsPreferences } from '@/components/settings/SettingsPreferences'

const props = {
  currentMonth: '2026-09', currency: 'ARS' as const, cards: [], accounts: [],
  heroBalanceMode: 'combined_ars' as const, signalsCenterEnabled: true,
}

describe('Mobile settings composition', () => {
  it.each([true, false])('preserves all existing preference visibility with signals=%s', (enabled) => {
    const html = renderToStaticMarkup(createElement(SettingsPreferences, { ...props, signalsCenterEnabled: enabled }))
    expect(html).toContain(enabled ? '>Perfil</h1>' : '>Configuración</h1>')
    expect(html.includes('Modo de cálculo')).toBe(enabled)
    expect(html.includes('Administrar suscripciones')).toBe(enabled)
    for (const label of ['Moneda predeterminada', 'Cuentas', 'Tarjetas', 'Alias de comercios', 'Compartir con Gota']) {
      expect(html).toContain(label)
    }
  })
  it('groups the period under accounts/cards, separately from global reading preferences', () => {
    const html = renderToStaticMarkup(createElement(SettingsPreferences, props))
    expect(html).toContain('aria-labelledby="settings-reading-title"')
    expect(html).toContain('aria-labelledby="settings-finances-title"')
    const finance = html.slice(html.indexOf('aria-labelledby="settings-finances-title"'))
    expect(finance).not.toContain('Mes anterior')
    expect(finance).not.toContain('Mes siguiente')
    const reading = html.slice(html.indexOf('aria-labelledby="settings-reading-title"'), html.indexOf('aria-labelledby="settings-finances-title"'))
    expect(reading).toContain('Moneda predeterminada')
    expect(reading).not.toContain('Mes anterior')
    expect(html).toContain('Alias de comercios')
    expect(html).toContain('Compartir con Gota')
    expect(html).not.toContain('Comprobantes')
  })
})
