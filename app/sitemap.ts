import type { MetadataRoute } from 'next'
import { buildSitemap, utcBuildDate } from '@/lib/sitemap'

// Captured when the production build loads this module, so lastmod is the build date.
const builtOn = utcBuildDate()

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(builtOn)
}
