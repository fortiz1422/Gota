import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sqlPath = new URL('../docs/supabase-shared-receipts.sql', import.meta.url)

describe('shared receipts migration', () => {
  it('defines a private, deduplicated receipt inbox and scoped token lookup', () => {
    const sql = readFileSync(sqlPath, 'utf8').toLowerCase()
    expect(sql).toContain('create table if not exists public.shared_receipts')
    expect(sql).toContain('unique (user_id, content_sha256)')
    expect(sql).toContain('alter table public.shared_receipts enable row level security')
    expect(sql).toContain("values ('shared-receipts-private'")
    expect(sql).toContain('public = false')
    expect(sql).toContain('token_prefix')
    expect(sql).toContain("array['receipt:write']")
  })

  it('keeps browser roles away from private rows and storage objects', () => {
    const sql = readFileSync(sqlPath, 'utf8').toLowerCase()
    expect(sql).toContain('revoke all on public.shared_receipts from anon, authenticated')
    expect(sql).not.toMatch(/create policy[\s\S]+shared_receipts/)
    expect(sql).not.toMatch(/create policy[\s\S]+storage\.objects/)
  })
})
