import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
}))

vi.mock('@/lib/flags', () => ({ FF_WEB_PANEL_BRIEF_V1: false }))

vi.mock('@/components/dashboard/desktop/DesktopDashboardShell', () => ({
  DesktopDashboardShell: (props: { initialNav?: string; onNavChange?: unknown }) =>
    createElement('div', {
      'data-initial-nav': props.initialNav ?? 'missing',
      'data-has-nav-change': typeof props.onNavChange === 'function' ? 'true' : 'false',
    }),
}))

vi.mock('@/components/dashboard/web-panel/WebPanelBriefV1', () => ({
  WebPanelBriefV1: () => createElement('div'),
}))

import { WebDashboardRoute } from '@/components/web/dashboard/WebDashboardRoute'

describe('WebDashboardRoute flag-off navigation', () => {
  it('preserves the URL-selected desktop view and URL-aware navigation callback', () => {
    const html = renderToStaticMarkup(createElement(WebDashboardRoute, {
      selectedMonth: '2026-07',
      viewCurrency: 'ARS',
      userEmail: 'facu@example.com',
      initialData: { isCurrentMonth: true } as never,
      initialQuote: null,
      initialView: 'movimientos',
    }))

    expect(html).toContain('data-initial-nav="movimientos"')
    expect(html).toContain('data-has-nav-change="true"')
  })
})
