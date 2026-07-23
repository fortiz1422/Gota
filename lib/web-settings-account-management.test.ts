import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/components/auth/PasskeysPanel', () => ({ PasskeysPanel: () => createElement('div') }))
vi.mock('@/components/settings/CuentasSubSheet', () => ({
  CuentasSubSheet: ({ onChanged }: { onChanged?: () => void }) => createElement('div', {
    'data-account-invalidation': typeof onChanged === 'function' ? 'wired' : 'missing',
  }),
}))

import { WebSettingsPage } from '@/components/web/settings/WebSettingsPage'

describe('WebSettingsPage account management', () => {
  it('exposes the mature account-management flow from Web settings', () => {
    const html = renderToStaticMarkup(createElement(WebSettingsPage, {
      email: 'facu@example.com',
      isAnonymous: false,
      authProviders: ['email'],
      currency: 'ARS',
      heroBalanceMode: 'combined_ars',
      accounts: [],
      cards: [],
    }))

    expect(html).toContain('Administrar cuentas')
    expect(html).toContain('data-account-invalidation="wired"')
  })
})
