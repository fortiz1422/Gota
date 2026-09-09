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

  it('anchors compact task CTAs directly above the iPhone bottom safe area', () => {
    const taskSurface = read('../components/ui/TaskSurface.tsx')
    const fullScreenSheet = read('../components/ui/FullScreenSheet.tsx')

    expect(fullScreenSheet).toContain('extendIntoBottomSafeArea?: boolean')
    expect(taskSurface).toContain('extendIntoBottomSafeArea={compact}')
    expect(taskSurface).toContain("compact ? 'pb-[max(12px,env(safe-area-inset-bottom))]' : 'pb-5'")
  })

  it('sizes mobile sheets from the fixed viewport overlay instead of a second dvh calculation', () => {
    const taskSurface = read('../components/ui/TaskSurface.tsx')
    const fullScreenSheet = read('../components/ui/FullScreenSheet.tsx')

    expect(fullScreenSheet).toContain('fillAvailableHeight?: boolean')
    expect(fullScreenSheet).toContain("fillAvailableHeight ? 'h-full' : 'h-[100dvh]'")
    expect(taskSurface).toContain('fillAvailableHeight={compact}')
  })

  it('renders account preferences with the canonical contained switch geometry', () => {
    const source = read('../components/settings/AccountBottomSheet.tsx')

    expect(source).toContain("import { Toggle } from '@/components/ui/Toggle'")
    expect(source.match(/<Toggle/g)).toHaveLength(2)
    expect(source).not.toContain("absolute top-0.5 h-5 w-5")
  })

  it('keeps expanded yield evidence flat and legible inside the behavior card', () => {
    const source = read('../components/settings/AccountBottomSheet.tsx')

    expect(source).toContain('data-account-yield-summary')
    expect(source).not.toContain('rounded-card border border-border-subtle bg-bg-secondary p-3')
    expect(source).toContain('font-semibold text-text-tertiary">TNA %')
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
