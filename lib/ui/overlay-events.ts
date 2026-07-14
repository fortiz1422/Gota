export const EXTERNAL_OVERLAY_CHANGE_EVENT = 'gota:external-overlay-change'

export type ExternalOverlayChangeDetail = {
  open: boolean
}

const activeOverlayIds = new Set<string>()

function publishExternalOverlayState(): void {
  if (typeof window === 'undefined') return

  const open = activeOverlayIds.size > 0
  const root = document.documentElement

  if (open) root.dataset.externalOverlay = 'open'
  else delete root.dataset.externalOverlay

  window.dispatchEvent(
    new CustomEvent<ExternalOverlayChangeDetail>(
      EXTERNAL_OVERLAY_CHANGE_EVENT,
      {
        detail: { open },
      }
    )
  )
}

/** Registra el estado de un overlay externo que debe bloquear superficies flotantes. */
export function setExternalOverlayOpen(id: string, open: boolean): void {
  if (open) activeOverlayIds.add(id)
  else activeOverlayIds.delete(id)

  publishExternalOverlayState()
}

export function isExternalOverlayOpen(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.externalOverlay === 'open'
}
