import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

describe('entrega 1 QA blockers', () => {
  it('does not render pendiente as the card list label', () => {
    const step = read('../components/onboarding/CardsStep.tsx')
    const state = read('../lib/card-setup-state.ts')
    expect(step).toContain('described.answerPhrase')
    expect(step).not.toContain('pendiente')
    expect(state).toContain('¿Resumen sin pagar?')
    expect(state).not.toContain('¿Resumen cerrado pendiente?')
    expect(state).not.toContain("'Resumen sin cargar'")
    expect(state).not.toContain("'Falta completar'")
    expect(state).toContain("'Resumen sin pagar'")
  })

  it('settings uses the shared card form, including more data and the bank note', () => {
    const settings = read('../components/settings/CardsSection.tsx')
    const form = read('../components/cards/CardSetupForm.tsx')
    expect(settings).toContain('<CardSetupForm')
    expect(settings).not.toContain('Completá el día de cierre')
    expect(form).toContain('Más datos')
    expect(form).toContain('Gota no conecta el banco ni activa débitos.')
    expect(form).toContain('No las sé, completar después')
  })

  it('leaves the home tour available and points it at the card note', () => {
    const setup = read('../lib/onboarding-setup.ts')
    const steps = read('../components/tour/tour-steps.ts')
    const home = read('../components/dashboard/DashboardShell.tsx')
    expect(setup).not.toContain('tour_completed')
    expect(steps).toContain("target: 'card-information'")
    expect(home).toContain('data-tour="card-information"')
  })
})
