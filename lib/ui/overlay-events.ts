export const EXTERNAL_OVERLAY_CHANGE_EVENT = 'gota:external-overlay-change'

export type ExternalOverlayChangeDetail = {
  open: boolean
  topOverlayId: string | null
}

export type OverlayRegistry = {
  open: (id: string) => number
  close: (id: string) => void
  top: () => string | null
  isTop: (id: string) => boolean
  ids: () => string[]
}

export function createOverlayRegistry(): OverlayRegistry {
  const stack: string[] = []
  const layers = new Map<string, number>()
  let nextLayer = 0

  return {
    open(id) {
      const existingLayer = layers.get(id)
      if (existingLayer !== undefined) return existingLayer

      nextLayer += 1
      stack.push(id)
      layers.set(id, nextLayer)
      return nextLayer
    },
    close(id) {
      const index = stack.indexOf(id)
      if (index === -1) return

      stack.splice(index, 1)
      layers.delete(id)
    },
    top() {
      return stack.at(-1) ?? null
    },
    isTop(id) {
      return stack.at(-1) === id
    },
    ids() {
      return [...stack]
    },
  }
}

const activeOverlays = createOverlayRegistry()

function publishExternalOverlayState(): void {
  if (typeof window === 'undefined') return

  const topOverlayId = activeOverlays.top()
  const open = topOverlayId !== null
  const root = document.documentElement

  if (open) root.dataset.externalOverlay = 'open'
  else delete root.dataset.externalOverlay

  window.dispatchEvent(
    new CustomEvent<ExternalOverlayChangeDetail>(EXTERNAL_OVERLAY_CHANGE_EVENT, {
      detail: { open, topOverlayId },
    })
  )
}

/** Registra el estado de un overlay externo que debe bloquear superficies flotantes. */
export function setExternalOverlayOpen(id: string, open: boolean): number | null {
  const layer = open ? activeOverlays.open(id) : null
  if (!open) activeOverlays.close(id)

  publishExternalOverlayState()
  return layer
}

export function isTopExternalOverlay(id: string): boolean {
  return activeOverlays.isTop(id)
}

export function isExternalOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.externalOverlay === 'open'
}
