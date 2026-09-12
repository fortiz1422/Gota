import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
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
    expect(html).not.toContain('disabled=""')
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

  it('uses compact canonical surfaces for goals and budgets', () => {
    const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8')
    const contribution = read('../components/analytics/GoalContributionSheet.tsx')
    const contributionEdit = read('../components/analytics/GoalContributionEditSheet.tsx')
    const link = read('../components/analytics/LinkTransferToGoalSheet.tsx')
    const budget = read('../components/analytics/BudgetEditorSheet.tsx')

    expect(contribution).toContain('<TaskSurface')
    expect(contribution).toContain('appearance="compact"')
    expect(contributionEdit).toContain('<TaskSurface')
    expect(contributionEdit).toContain('appearance="compact"')
    expect(link).toContain('<ChoiceSurface')
    expect(link).toContain('appearance="compact"')
    expect(budget).toContain('<TaskSurface')
    expect(budget).toContain('appearance="compact"')
    expect(contribution).not.toContain('>Cancelar<')
    expect(contributionEdit).not.toContain('>Cancelar<')
    expect(link).not.toContain('>Cancelar<')
    expect(budget).not.toContain('>Cancelar<')
    expect(budget).toContain('parseArDecimalInput')
    expect(budget).toContain('onRequestDelete')
  })

  it('keeps detail management, destructive confirmations, and exact request contracts', () => {
    const detail = readFileSync(new URL('../components/analytics/GoalDetailSheet.tsx', import.meta.url), 'utf8')
    const history = readFileSync(new URL('../components/analytics/GoalContributionHistory.tsx', import.meta.url), 'utf8')
    const budgets = readFileSync(new URL('../components/analytics/BudgetsSection.tsx', import.meta.url), 'utf8')
    const contribution = readFileSync(new URL('../components/analytics/GoalContributionSheet.tsx', import.meta.url), 'utf8')

    expect(detail).toContain('<ManagementSurface')
    expect(detail).not.toContain('<Modal')
    expect(history).toContain('<ConfirmationSurface')
    expect(history).not.toContain('onClick={() => handleDelete')
    expect(budgets).toContain('<ConfirmationSurface')
    expect(budgets).not.toContain('alert(')
    expect(budgets).toContain("periodMonth: `${selectedMonth}-01`")
    expect(budgets).toContain('baseCurrency: currency')
    expect(contribution).toContain("sourceType: 'manual'")
    expect(contribution).toContain('availabilityEffect')
    expect(contribution).toContain('destinationKind')
  })
})