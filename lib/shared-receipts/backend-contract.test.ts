import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const route = (path: string) => readFileSync(new URL(`../../app/api/shared-receipts/${path}`, import.meta.url), 'utf8')

describe('shared receipt backend gates', () => {
  it('claims received normally and parse_failed only on explicit retry', () => {
    const source = route('[id]/analyze/route.ts')
    expect(source).toContain("retry ? ['parse_failed'] : ['received']")
    expect(source).not.toContain("['received', 'needs_review', 'parse_failed']")
  })

  it.each(['route.ts', '[id]/route.ts', '[id]/analyze/route.ts', '[id]/confirm/route.ts'])(
    'sets no-store on every receipt route module: %s',
    (path) => expect(route(path)).toContain("'Cache-Control': 'private, no-store'"),
  )

  it('keeps inbox listing to a non-financial summary projection', () => {
    const source = route('route.ts')
    expect(source).toContain("select('id,status,source_kind,source_app_hint,original_filename,mime_type,created_at,expires_at')")
    expect(source).not.toContain("select('id,status,source_kind,source_app_hint,original_filename,mime_type,byte_size,parsed_payload")
  })

  it('consumes the persistent per-device upload limit before parsing the multipart body', () => {
    const source = readFileSync(
      new URL('../../app/api/shortcut/v1/receipts/route.ts', import.meta.url),
      'utf8',
    )
    const rateLimitCall = source.indexOf("'consume_shared_receipt_rate_limit'")
    const formParsing = source.indexOf('request.formData()')
    expect(rateLimitCall).toBeGreaterThan(0)
    expect(rateLimitCall).toBeLessThan(formParsing)
    expect(source).toContain("{ error: 'rate_limited' }")
    expect(source).toContain("'Retry-After': '600'")
  })

  it('exposes authenticated cleanup through the scheduled Vercel GET contract', () => {
    const cronRoute = readFileSync(
      new URL('../../app/api/cron/shared-receipts/route.ts', import.meta.url),
      'utf8',
    )
    const vercel = JSON.parse(
      readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'),
    ) as { crons: Array<{ path: string; schedule: string }> }
    expect(cronRoute).toContain('export async function GET(request: Request)')
    expect(cronRoute).toContain('process.env.CRON_SECRET')
    expect(vercel.crons).toContainEqual({
      path: '/api/cron/shared-receipts',
      schedule: '17 3 * * *',
    })
  })
})
