import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import copy from './landing-copy.json'
import { renderLandingHtml } from './render-landing'

export const dynamic = 'force-static'

const html = renderLandingHtml(
  readFileSync(join(process.cwd(), 'app/landing/landing-v57.html'), 'utf8'),
  copy,
  process.env.LANDING_CTA_URL
)

export function GET() {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  })
}
