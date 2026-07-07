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

