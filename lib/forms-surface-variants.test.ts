import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { ChoiceSurface } from '@/components/ui/ChoiceSurface'
import { ManagementSurface } from '@/components/ui/ManagementSurface'
import { ConfirmationSurface } from '@/components/ui/ConfirmationSurface'

vi.mock('@/components/ui/FullScreenSheet', () => ({ FullScreenSheet: ({ children }: { children: ReactNode }) => createElement('div', null, children) }))
const noop = () => {}
const common = { open: true, onClose: noop, eyebrow: 'PRUEBA', title: 'Título', description: 'Descripción', children: createElement('p', null, 'Contenido') }
describe('opt-in form surfaces preserve the original markup', () => {
  for (const appearance of ['brand', 'compact'] as const) {
    it(`TaskSurface ${appearance}`, () => expect(renderToStaticMarkup(createElement(TaskSurface, { ...common, appearance, footer: 'Guardar' }))).toMatchSnapshot())
    it(`ChoiceSurface ${appearance}`, () => expect(renderToStaticMarkup(createElement(ChoiceSurface, { ...common, appearance }))).toMatchSnapshot())
    it(`ConfirmationSurface ${appearance}`, () => expect(renderToStaticMarkup(createElement(ConfirmationSurface, { ...common, appearance, onConfirm: noop, confirmLabel: 'Confirmar' }))).toMatchSnapshot())
  }
  it('ManagementSurface', () => expect(renderToStaticMarkup(createElement(ManagementSurface, { ...common, action: 'Agregar' }))).toMatchSnapshot())
})


describe('explicit form variants', () => {
  it('places the blue hero in the header', () => {
    const html = renderToStaticMarkup(createElement(TaskSurface, { ...common, variant: 'blue-hero', hero: createElement('input', { 'aria-label': 'Monto' }), footer: 'Guardar' }))
    expect(html).toContain('data-surface-variant="blue-hero"')
    expect(html.indexOf('aria-label="Monto"')).toBeLessThan(html.indexOf('</header>'))
    expect(html).toContain('aria-label="Cerrar Título"')
  })
  it('keeps the accessible title when the intro is hidden', () => {
    const html = renderToStaticMarkup(createElement(TaskSurface, { ...common, variant: 'r', showIntro: false, footer: null }))
    expect(html).toContain('data-surface-variant="r"')
    expect(html).toMatch(/<p id="[^"]+">Título<\/p>/)
  })
  it('blocks both R confirmation dismissal controls while busy', () => {
    const html = renderToStaticMarkup(createElement(ConfirmationSurface, { ...common, variant: 'r', busy: true, onConfirm: noop, confirmLabel: 'Confirmar' }))
    expect(html).toContain('Procesando…')
    expect(html.match(/disabled=""/g)).toHaveLength(3)
  })
})
