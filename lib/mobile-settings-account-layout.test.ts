import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/lib/auth', () => ({ isPasskeySupported: () => false }))
import { AccountSection } from '@/components/settings/AccountSection'
describe('Mobile account sections', () => {
  it('separates privacy from access, keeping auth and deletion controls', () => {
    const html = renderToStaticMarkup(createElement(AccountSection, {email:'example@example.invalid',isAnonymous:false,authProviders:['email']}))
    expect(html).toContain('aria-labelledby="settings-privacy-title"')
    for (const label of ['Actualizar contraseña','Passkeys','Privacidad y datos','Eliminar mi cuenta','Cerrar sesión']) expect(html).toContain(label)
    expect(html).toContain('href="/privacy"')
    expect(html).not.toContain('<summary')
  })
  it('keeps anonymous upgrade messaging without password controls', () => {
    const html = renderToStaticMarkup(createElement(AccountSection, {email:'',isAnonymous:true,authProviders:[]}))
    expect(html).toContain('Modo exploracion')
    expect(html).not.toContain('Crear contraseña')
    expect(html).toContain('Privacidad y datos')
  })
})
