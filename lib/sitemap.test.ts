import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import sitemap from '@/app/sitemap'
import { buildSitemap, utcBuildDate } from './sitemap'

describe('sitemap build date', () => {
  it('uses the date it is given, in YYYY-MM-DD', () => {
    expect(buildSitemap('2024-05-06')).toEqual([
      { url: 'https://gota.money/', lastModified: '2024-05-06' },
      { url: 'https://gota.money/privacy', lastModified: '2024-05-06' },
      { url: 'https://gota.money/terms', lastModified: '2024-05-06' },
    ])
    expect(() => buildSitemap('15/10/2026')).toThrow(/YYYY-MM-DD/)
  })

  it('stamps the route with the UTC date at module load, not a hardcoded day', () => {
    const source = readFileSync(join(process.cwd(), 'app/sitemap.ts'), 'utf8')
    expect(source).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(source).toContain('utcBuildDate()')
    const today = utcBuildDate()
    expect(sitemap().map((entry) => entry.lastModified)).toEqual([
      today,
      today,
      today,
    ])
    expect(sitemap().map((entry) => entry.url)).toEqual([
      'https://gota.money/',
      'https://gota.money/privacy',
      'https://gota.money/terms',
    ])
  })
})
