import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { GoalProgressBar } from '@/components/analytics/GoalProgressBar'
import { BudgetEditorSheet } from '@/components/analytics/BudgetEditorSheet'
import type { BudgetItemMetrics } from '@/lib/budgets/types'
import { formatAmount } from '@/lib/format'
vi.mock('@/components/ui/FullScreenSheet', () => ({ FullScreenSheet: ({ children }: { children: ReactNode }) => createElement('div', null, children) }))
for (const paceStatus of ['on_track', 'behind', 'no_date', 'completed', 'paused'] as const) it(`default progress bar remains identical: ${paceStatus}`, () => {
  expect(renderToStaticMarkup(createElement(GoalProgressBar, { pct: .5, paceStatus }))).toMatchSnapshot()
})
const done = async () => {}
for (const currency of ['ARS', 'USD'] as const) it(`budget total displays valid positive rows in ${currency}`, () => {
  const initialItems: BudgetItemMetrics[] = [220000, 90000, 45000, 0, -1, Number.NaN].map((amount, i) => ({ id: String(i), category: String(i), amount, spentAmount: 0, remainingAmount: 0, usedPct: 0, expectedPct: 0, paceDelta: 0, status: 'on_track' }))
  const html = renderToStaticMarkup(createElement(BudgetEditorSheet, { open: true, mode: 'edit', currency, initialItems, availableCategories: [], onClose: () => {}, onCreate: done, onSync: done }))
  expect(html).toContain('TOTAL MENSUAL')
  expect(html).toContain(formatAmount(355000, currency))
  expect(html).not.toContain('Podés ajustar montos')
})
