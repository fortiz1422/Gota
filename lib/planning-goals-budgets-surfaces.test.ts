import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('planning goals and budgets task surfaces', () => {
  it('passes a real initial focus ref to each migrated task form', () => {
    const contribution = read('../components/analytics/GoalContributionSheet.tsx')
    const contributionEdit = read('../components/analytics/GoalContributionEditSheet.tsx')
    const budget = read('../components/analytics/BudgetEditorSheet.tsx')

    for (const source of [contribution, contributionEdit]) {
      expect(source).toContain('useRef<HTMLInputElement>(null)')
      expect(source).toContain('initialFocusRef={amountRef}')
      expect(source).toContain('ref={amountRef}')
    }

    expect(budget).toContain('const categoryRef = useRef<HTMLSelectElement>(null)')
    expect(budget).toContain('const amountRef = useRef<HTMLInputElement>(null)')
    expect(budget).toContain('initialFocusRef={initialFocusRef}')
    expect(budget).toContain('ref={index === 0 ? categoryRef : undefined}')
    expect(budget).toContain('ref={index === 0 ? amountRef : undefined}')
    expect(budget).toContain('const firstItem = draftItems[0]')
    expect(budget).toContain('const getInitialDraftItems = (')
    expect(budget).toContain('useState<DraftItem[]>(() => getInitialDraftItems(initialItems, availableCategories))')
    expect(budget).toContain('setDraftItems(getInitialDraftItems(initialItems, availableCategories))')
  })

  it('uses a responsive budget row with compact layout only above mobile width', () => {
    const source = read('../components/analytics/BudgetEditorSheet.tsx')

    expect(source).not.toContain('grid-cols-[1fr_132px_auto]')
    expect(source).toContain('grid-cols-1')
    expect(source).toContain('sm:grid-cols-[minmax(0,1fr)_132px_auto]')
    expect(source).toContain('min-h-11')
    expect(source).toContain('min-w-0')
  })
})
