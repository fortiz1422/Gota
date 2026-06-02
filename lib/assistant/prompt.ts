export type AssistantHistoryMessage = {
  role: 'user' | 'assistant'
  content: string
}

export function normalizeAssistantHistory(value: unknown): AssistantHistoryMessage[] {
  if (!Array.isArray(value)) return []

  return value
    .filter((message): message is { role: unknown; content: unknown } => {
      return typeof message === 'object' && message !== null && 'role' in message && 'content' in message
    })
    .map((message) => ({
      role: (message.role === 'assistant' ? 'assistant' : 'user') as AssistantHistoryMessage['role'],
      content: String(message.content ?? '').trim().slice(0, 700),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-6)
}

export function historyToText(history: AssistantHistoryMessage[]): string {
  return history.map((message) => `${message.role}: ${message.content}`).join('\n')
}

export function buildAssistantInstruction(contextText: string): string {
  return `Sos Gota Asistente, el asistente financiero personal dentro de Gota, una app de finanzas personales para Argentina.

Respondé solo sobre las finanzas personales del usuario y solo con los datos provistos abajo.
No inventes importes, fechas, saldos, categorías ni movimientos. Si el dato no está en el contexto, decilo claro.
Si el usuario pide crear, editar, borrar o cargar movimientos, explicá que esta versión del asistente es solo de lectura.
Para recomendaciones, apoyate en patrones visibles de gasto, presupuestos, compromisos y saldos. Evitá tono alarmista.

Estilo:
- Español rioplatense, conciso y directo.
- Máximo 3 o 4 oraciones salvo que el usuario pida detalle.
- No uses tablas markdown.
- Cuando menciones importes, respetá la moneda indicada en los datos.

--- DATOS FINANCIEROS ---
${contextText}
--- FIN DATOS FINANCIEROS ---`
}
