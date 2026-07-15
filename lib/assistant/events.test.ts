import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ASSISTANT_OPEN_EVENT,
  requestAssistantOpen,
  type AssistantOpenDetail,
} from '@/lib/assistant/events'
import { setExternalOverlayOpen } from '@/lib/ui/overlay-events'

class TestCustomEvent<T> extends Event {
  detail: T

  constructor(type: string, init: { detail: T }) {
    super(type)
    this.detail = init.detail
  }
}

function installBrowserGlobals() {
  const windowTarget = new EventTarget()
  vi.stubGlobal('window', windowTarget)
  vi.stubGlobal('document', { documentElement: { dataset: {} } })
  vi.stubGlobal('CustomEvent', TestCustomEvent)
  return windowTarget
}

afterEach(() => {
  setExternalOverlayOpen('test-sheet', false)
  vi.unstubAllGlobals()
})

describe('requestAssistantOpen', () => {
  it('dispatches immediately when there is no external overlay', () => {
    const windowTarget = installBrowserGlobals()
    let received: AssistantOpenDetail | null = null
    windowTarget.addEventListener(ASSISTANT_OPEN_EVENT, (event) => {
      received = (event as TestCustomEvent<AssistantOpenDetail>).detail
    })

    requestAssistantOpen({ question: '¿Qué cambió?' })

    expect(received).toEqual({ question: '¿Qué cambió?' })
  })

  it('waits for the overlay cleanup before dispatching', () => {
    const windowTarget = installBrowserGlobals()
    let received: AssistantOpenDetail | null = null
    windowTarget.addEventListener(ASSISTANT_OPEN_EVENT, (event) => {
      received = (event as TestCustomEvent<AssistantOpenDetail>).detail
    })
    setExternalOverlayOpen('test-sheet', true)

    requestAssistantOpen({ question: 'Explicame esta señal' })
    expect(received).toBeNull()

    setExternalOverlayOpen('test-sheet', false)
    expect(received).toEqual({ question: 'Explicame esta señal' })
  })
})
