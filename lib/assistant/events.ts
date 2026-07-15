import {
  EXTERNAL_OVERLAY_CHANGE_EVENT,
  isExternalOverlayOpen,
  type ExternalOverlayChangeDetail,
} from '@/lib/ui/overlay-events'

export const ASSISTANT_OPEN_EVENT = 'gota:assistant-open'

export type AssistantOpenDetail = {
  question?: string
}

/** Pide abrir Gota Asistente, opcionalmente con una pregunta prearmada. */
export function requestAssistantOpen(detail: AssistantOpenDetail = {}): void {
  if (typeof window === 'undefined') return

  const dispatch = () => {
    window.dispatchEvent(
      new CustomEvent<AssistantOpenDetail>(ASSISTANT_OPEN_EVENT, { detail }),
    )
  }

  if (!isExternalOverlayOpen()) {
    dispatch()
    return
  }

  // El cleanup del sheet publica este evento. Esperar esa señal evita perder
  // la solicitud por una carrera entre el render de cierre y el overlay stack.
  const onOverlayChange = (event: Event) => {
    const state = (event as CustomEvent<ExternalOverlayChangeDetail>).detail
    if (state?.open) return
    window.removeEventListener(EXTERNAL_OVERLAY_CHANGE_EVENT, onOverlayChange)
    dispatch()
  }
  window.addEventListener(EXTERNAL_OVERLAY_CHANGE_EVENT, onOverlayChange)
}
