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

  it('keeps browser roles away from private rows, storage objects and financial RPCs', () => {
    const sql = readFileSync(sqlPath, 'utf8').toLowerCase()
    expect(sql).toContain('revoke all on public.shared_receipts from anon, authenticated')
    expect(sql).not.toMatch(/create policy[\s\S]+shared_receipts/)
    expect(sql).not.toMatch(/create policy[\s\S]+storage\.objects/)
    expect(sql).toContain('revoke all on function public.confirm_shared_receipt_purchase(uuid, uuid, jsonb, text) from public, anon, authenticated')
    expect(sql).toContain('grant execute on function public.confirm_shared_receipt_purchase(uuid, uuid, jsonb, text) to service_role')
    expect(sql).not.toMatch(/grant execute on function public\.confirm_shared_receipt_purchase[^;]+authenticated/)
  })

  it('uses the 10 MiB and canonical inbox state contract without assuming last-four uniqueness', () => {
    const sql = readFileSync(sqlPath, 'utf8').toLowerCase()
    expect(sql).toContain('byte_size <= 10485760')
    expect(sql).toContain("values ('shared-receipts-private', 'shared-receipts-private', false, 10485760")
    for (const status of ['received', 'parsing', 'needs_review', 'parse_failed', 'confirmed', 'dismissed', 'expired']) {
      expect(sql).toContain(`'${status}'`)
    }
    expect(sql).not.toContain('create unique index if not exists cards_user_last_four_unique')
  })

  it('locks and revalidates owner, source proposal and instruments before an atomic expense insert', () => {
    const sql = readFileSync(sqlPath, 'utf8').toLowerCase()
    expect(sql).toContain('create or replace function public.confirm_shared_receipt_purchase')
    expect(sql).toMatch(/from public\.shared_receipts[\s\S]+for update/)
    expect(sql).toContain('v_receipt.user_id <> p_user_id')
    expect(sql).toMatch(/v_receipt\.parsed_payload->>'transaction_type'[\s\S]+<> 'purchase'/)
    expect(sql).toMatch(/from public\.accounts[\s\S]+for update/)
    expect(sql).toMatch(/from public\.cards[\s\S]+for update/)
    expect(sql).toContain('insert into public.expenses')
    expect(sql).toContain('source_shared_receipt_id')
    expect(sql).toContain("status = 'confirmed'")
    expect(sql).toContain('confirmation_payload_hash = p_payload_hash')
  })

  it('defines idempotent replay and explicitly constrains v1 to one canonical purchase', () => {
    const sql = readFileSync(sqlPath, 'utf8').toLowerCase()
    expect(sql).toContain("v_receipt.status = 'confirmed'")
    expect(sql).toContain('v_receipt.confirmation_payload_hash = p_payload_hash')
    expect(sql).toContain("coalesce((p_payload->>'installments')::integer, 1) <> 1")
    expect(sql).toContain('v1 intentionally confirms one expense row')
  })
})
