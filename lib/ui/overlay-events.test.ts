import { describe, expect, it } from 'vitest'
import { createOverlayRegistry } from '@/lib/ui/overlay-events'

describe('overlay registry', () => {
  it('mantiene orden de stack y expone solo el overlay superior', () => {
    const registry = createOverlayRegistry()

    const firstLayer = registry.open('sheet-a')
    const secondLayer = registry.open('sheet-b')

    expect(secondLayer).toBeGreaterThan(firstLayer)
    expect(registry.top()).toBe('sheet-b')
    expect(registry.isTop('sheet-a')).toBe(false)
    expect(registry.isTop('sheet-b')).toBe(true)
  })

  it('tolera cleanup fuera de orden sin alterar el overlay superior', () => {
    const registry = createOverlayRegistry()
    registry.open('sheet-a')
    registry.open('sheet-b')
    registry.open('sheet-c')

    registry.close('sheet-b')
    registry.close('unknown')

    expect(registry.ids()).toEqual(['sheet-a', 'sheet-c'])
    expect(registry.top()).toBe('sheet-c')

    registry.close('sheet-c')
    expect(registry.top()).toBe('sheet-a')
  })

  it('no duplica un id ni cambia su capa por un registro repetido', () => {
    const registry = createOverlayRegistry()

    const layer = registry.open('sheet-a')
    expect(registry.open('sheet-a')).toBe(layer)
    expect(registry.ids()).toEqual(['sheet-a'])
  })
})
