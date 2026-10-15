export type SitemapEntry = {
  url: string
  lastModified: string
}

const PUBLIC_URLS = [
  'https://gota.money/',
  'https://gota.money/privacy',
  'https://gota.money/terms',
] as const

/** `lastmod` is the build date, `YYYY-MM-DD`, passed in by the route when it loads. */
export function buildSitemap(lastmod: string): SitemapEntry[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) {
    throw new Error('lastmod debe ser YYYY-MM-DD')
  }
  return PUBLIC_URLS.map((url) => ({ url, lastModified: lastmod }))
}

export function utcBuildDate(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}
