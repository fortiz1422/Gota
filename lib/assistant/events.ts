export const ASSISTANT_OPEN_EVENT = 'gota:assistant-open'

export type AssistantOpenDetail = {
  question?: string
}

/** Pide abrir Gota Asistente, opcionalmente con una pregunta prearmada. */
export function requestAssistantOpen(detail: AssistantOpenDetail = {}): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<AssistantOpenDetail>(ASSISTANT_OPEN_EVENT, { detail }))
}
