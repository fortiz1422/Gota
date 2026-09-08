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
})