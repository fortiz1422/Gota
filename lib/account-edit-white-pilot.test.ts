import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('Account edit white pilot', () => {
  it('keeps branded create tasks while opting only account editing into compact chrome', () => {
    const source = read('../components/settings/AccountBottomSheet.tsx')
    const taskSurface = read('../components/ui/TaskSurface.tsx')

    expect(source).toContain("appearance={isNew ? 'brand' : 'compact'}")
    expect(source).toContain("navigationTitle={isNew ? undefined : 'Editar cuenta'}")
    expect(taskSurface).toContain("appearance?: 'brand' | 'compact'")
    expect(taskSurface).toContain('data-task-header="compact"')
    expect(taskSurface).toContain('data-task-intro')
  })

  it('groups account edit controls into white semantic sections without tertiary field wells', () => {
    const source = read('../components/settings/AccountBottomSheet.tsx')

    expect(source).toContain('data-account-edit-information')
    expect(source).toContain('data-account-edit-behavior')
    expect(source).toContain('data-account-edit-archive')
    expect(source).toContain("const editInputClass =")
    expect(source).toContain("isNew ? legacyInputClass : editInputClass")
    expect(source).toContain('surface-module')
  })
})
