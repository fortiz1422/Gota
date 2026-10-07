/** Server-only policy. Public users never get a paid fallback automatically. */
export function canUsePaidAI(user: {
  id: string
  is_anonymous?: boolean
}): boolean {
  if (
    process.env.GOTA_PAID_AI_ENABLED !== 'true' ||
    user.is_anonymous !== false
  )
    return false
  const allowed = (process.env.GOTA_PAID_AI_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return allowed.includes(user.id)
}

export const PAID_AI_UNAVAILABLE =
  'Esta función todavía no está disponible para esta cuenta. Podés registrar el gasto escribiéndolo.'
