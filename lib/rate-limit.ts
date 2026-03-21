const requests = new Map<string, number[]>()

export function checkRateLimit(userId: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now()
  const timestamps = (requests.get(userId) ?? []).filter((t) => now - t < windowMs)
  if (timestamps.length >= limit) return false
  timestamps.push(now)
  requests.set(userId, timestamps)
  return true
}
