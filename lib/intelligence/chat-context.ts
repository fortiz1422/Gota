import {
  extractSimulation,
  normalizeText,
  planChatQuery,
  type ChatIntent,
  type ChatQueryPlan,
} from './chat-planner'

/**
 * Contexto conversacional determinístico (guía v1.1, Fase G): los follow-ups
 * cortos ("¿Y el mes pasado?", "¿Y en 6 cuotas?") heredan los slots del turno
 * anterior sin pedirle al LLM que invente contexto financiero.
 */

export type ConversationSlots = {
  intent: ChatIntent | null
  terms: string[]
  amount: number | null
  installments: number | null
}

export function extractSlots(plan: ChatQueryPlan): ConversationSlots {
  return {
    intent: plan.intent,
    terms: plan.movementFilter.terms,
    amount: plan.simulation.amount,
    installments: plan.simulation.installments,
  }
}

/** Conserva solo los valores no nulos (para mergear slots). */
function pickDefined(simulation: { amount: number | null; installments: number | null }) {
  const result: Partial<Pick<ConversationSlots, 'amount' | 'installments'>> = {}
  if (simulation.amount !== null) result.amount = simulation.amount
  if (simulation.installments !== null) result.installments = simulation.installments
  return result
}

/** Follow-up corto: arranca con "y ..." (p. ej. "¿y el mes pasado?"). */
function isShortFollowUp(question: string): boolean {
  const normalized = normalizeText(question).trim().replace(/^[^a-z0-9]+/, '')
  return /^y\b/.test(normalized) && normalized.split(/\s+/).length <= 7
}

/**
 * Plan del turno con contexto: si la pregunta es un follow-up corto sin
 * sujeto propio (sin categoría ni monto), hereda intent, secciones y slots
 * del turno anterior, conservando lo que el follow-up sí cambia
 * (ventana temporal, cantidad de cuotas).
 */
export function planWithConversationContext(
  question: string,
  previousUserQuestion: string | null,
): ChatQueryPlan {
  const plan = planChatQuery(question)
  if (!previousUserQuestion || !isShortFollowUp(question)) return plan

  const previous = planChatQuery(previousUserQuestion)
  // El plan solo llena simulation para affordability: acá extraemos siempre.
  const slots = { ...extractSlots(previous), ...pickDefined(extractSimulation(previousUserQuestion)) }
  const currentSimulation = extractSimulation(question)
  const hasOwnSubject = plan.movementFilter.terms.length > 0 || currentSimulation.amount !== null
  if (hasOwnSubject) return plan

  // "¿Y en 6 cuotas?": retiene el monto anterior, cambia las cuotas.
  if (currentSimulation.installments !== null && slots.amount !== null) {
    return {
      ...previous,
      intent: 'affordability',
      movementFilter: { ...previous.movementFilter, window: plan.movementFilter.window },
      simulation: { amount: slots.amount, installments: currentSimulation.installments },
    }
  }

  // "¿Y el mes pasado?": retiene categoría/intención, cambia la ventana.
  if (slots.terms.length > 0 || slots.amount !== null) {
    return {
      ...previous,
      movementFilter: { ...previous.movementFilter, window: plan.movementFilter.window },
      simulation: { ...previous.simulation },
    }
  }

  return plan
}
