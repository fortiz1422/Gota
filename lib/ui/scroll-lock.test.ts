import { describe, expect, it } from 'vitest'
import { createScrollLockManager, type ScrollLockEnvironment } from '@/lib/ui/scroll-lock'

function createEnvironment() {
  const scrollCalls: Array<[number, number]> = []
  const environment: ScrollLockEnvironment = {
    bodyStyle: {
      overflow: 'clip',
      position: 'relative',
      top: '4px',
      width: '80%',
    },
    rootStyle: { overflow: 'auto' },
    getScrollY: () => 240,
    scrollTo: (x, y) => scrollCalls.push([x, y]),
  }

  return { environment, scrollCalls }
}

describe('scroll lock compartido', () => {
  it('captura y restaura exactamente estilos y scroll al liberar el último lock', () => {
    const { environment, scrollCalls } = createEnvironment()
    const locks = createScrollLockManager(environment)

    locks.acquire('assistant')

    expect(environment.rootStyle.overflow).toBe('hidden')
    expect(environment.bodyStyle).toEqual({
      overflow: 'hidden',
      position: 'fixed',
      top: '-240px',
      width: '100%',
    })

    locks.release('assistant')

    expect(environment.rootStyle.overflow).toBe('auto')
    expect(environment.bodyStyle).toEqual({
      overflow: 'clip',
      position: 'relative',
      top: '4px',
      width: '80%',
    })
    expect(scrollCalls).toEqual([[0, 240]])
  })

  it('mantiene el body bloqueado ante releases fuera de orden', () => {
    const { environment, scrollCalls } = createEnvironment()
    const locks = createScrollLockManager(environment)

    locks.acquire('assistant')
    locks.acquire('sheet')
    locks.release('assistant')
    locks.release('missing')

    expect(locks.isLocked()).toBe(true)
    expect(environment.bodyStyle.position).toBe('fixed')
    expect(scrollCalls).toEqual([])

    locks.release('sheet')
    expect(locks.isLocked()).toBe(false)
    expect(environment.bodyStyle.position).toBe('relative')
    expect(scrollCalls).toEqual([[0, 240]])
  })

  it('trata acquire repetido del mismo id como un solo lock', () => {
    const { environment, scrollCalls } = createEnvironment()
    const locks = createScrollLockManager(environment)

    locks.acquire('sheet')
    locks.acquire('sheet')
    locks.release('sheet')

    expect(locks.isLocked()).toBe(false)
    expect(scrollCalls).toEqual([[0, 240]])
  })
})
