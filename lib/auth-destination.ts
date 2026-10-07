/** Keep redirects local, reject encoded/ambiguous authorities and auth loops. */
export function safeDestination(
  value: string | null | undefined,
  fallback = '/'
): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u0020]/.test(value)
  )
    return fallback
  try {
    const url = new URL(value, 'https://gota.local')
    if (url.origin !== 'https://gota.local') return fallback
    if (
      /^\/(login|start)(\/|$)/.test(url.pathname) ||
      /^\/auth\/(callback|error)(\/|$)/.test(url.pathname)
    )
      return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}
