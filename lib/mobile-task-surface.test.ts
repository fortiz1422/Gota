import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/FullScreenSheet', () => ({
  FullScreenSheet: ({
    children,
    extendIntoTopSafeArea,
    labelledBy,
  }: {
    children: ReactNode
    extendIntoTopSafeArea?: boolean
    labelledBy: string
  }) => createElement(
    'div',
    {
      'data-full-screen-sheet': 'true',
      'data-extends-safe-area': String(Boolean(extendIntoTopSafeArea)),
      'aria-labelledby': labelledBy,
    },
    children,
  ),
}))

import { GoalCreateSheet } from '@/components/analytics/GoalCreateSheet'
import { GoalEditSheet } from '@/components/analytics/GoalEditSheet'
import type { GoalWithMetrics } from '@/lib/goals/types'

const goalFixture: GoalWithMetrics = {
  id: 'goal-test', name: 'Viaje a Japón', emoji: '✈️', colorToken: null,
  targetAmount: 6500000, currency: 'ARS', targetDate: '2027-04-15',
  startingAmount: 0, plannedMonthlyContribution: 320000, linkedAccountId: null,
  notes: 'Pasajes y estadía', status: 'active', createdAt: '2026-09-08',
  completedAt: null, pausedAt: null, currentAmount: 1450000, remainingAmount: 5050000,
  progressPct: 22.3, monthsRemaining: 7, requiredMonthlyContribution: 721429,
  paceStatus: 'behind', lastContributionAt: '2026-09-01', committedAmount: 1450000,
}

describe('Mobile Task Surface pilot', () => {
  it('renders Nueva meta with the canonical hierarchy and fixed action contract', () => {
    const html = renderToStaticMarkup(createElement(GoalCreateSheet, {
      open: true,
      onClose: vi.fn(),
      onCreated: vi.fn(),
    }))

    expect(html).toContain('data-full-screen-sheet="true"')
    expect(html).toContain('data-extends-safe-area="true"')
    expect(html).toContain('PLANIFICAR')
    expect(html).toContain('Nueva meta')
    expect(html).toContain('Definí a dónde querés llegar')
    expect(html).toContain('>META<')
    expect(html).toContain('Monto objetivo')
    expect(html).toContain('>PLAN<')
    expect(html).toContain('>CONTEXTO<')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('Crear meta')
    expect(html).toContain('Cancelar')
    expect(html).not.toContain('disabled=""')
    expect(html.indexOf('Crear meta')).toBeLessThan(html.lastIndexOf('Cancelar'))
  })

  it('keeps the task closed when the owner says it is closed', () => {
    const html = renderToStaticMarkup(createElement(GoalCreateSheet, {
      open: false,
      onClose: vi.fn(),
      onCreated: vi.fn(),
    }))

    expect(html).toBe('')
  })

  it('renders Editar meta as the same Task Surface without exposing currency mutation', () => {
    const html = renderToStaticMarkup(createElement(GoalEditSheet, {
      open: true,
      goal: goalFixture,
      onClose: vi.fn(),
      onSaved: vi.fn(),
    }))

    expect(html).toContain('data-full-screen-sheet="true"')
    expect(html).toContain('Editar meta')
    expect(html).toContain('Los aportes ya registrados no cambian')
    expect(html).toContain('Moneda')
    expect(html).toContain('ARS')
    expect(html).toContain('No editable')
    expect(html).toContain('Guardar cambios')
    expect(html).not.toContain('aria-pressed=')
  })
})