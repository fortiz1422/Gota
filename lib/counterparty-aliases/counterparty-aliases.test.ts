import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { normalizeCounterpartyAlias } from './normalize'
import { applyCounterpartyResolution, resolveCounterpartyAlias } from './resolve'
import { rememberCounterpartyAfterConfirmation } from './remember'

describe('counterparty alias normalization', () => {
  it('matches accents, punctuation and case deterministically', () => {
    expect(normalizeCounterpartyAlias('  BEL-MÁRFER... S.A. ')).toBe('bel marfer s a')
  })

  it('rejects empty normalized values and bounds input to 160 characters', () => {
    expect(() => normalizeCounterpartyAlias('---')).toThrow('empty')
    expect(() => normalizeCounterpartyAlias('a'.repeat(161))).toThrow('160')
  })

  it('rejects bank, fiscal and full-card identifiers but preserves legitimate alphanumeric merchants', () => {
    expect(() => normalizeCounterpartyAlias('CBU 2850590940090418135201')).toThrow('financial identifier')
    expect(() => normalizeCounterpartyAlias('CUIT 20-12345678-9')).toThrow('financial identifier')
    expect(() => normalizeCounterpartyAlias('Visa 4111 1111 1111 1111')).toThrow('financial identifier')
    expect(normalizeCounterpartyAlias('TIENDA24HORASBELMAR')).toBe('tienda24horasbelmar')
  })
})

describe('counterparty alias resolution', () => {
  const match = {
    alias_id: 'alias-1',
    profile_id: 'profile-1',
    alias_value: 'BEL MARFER',
    normalized_value: 'bel marfer',
    display_name: 'Belmar',
    default_category: 'Supermercado' as const,
    match_type: 'exact' as const,
  }

  it('prioritizes an exact normalized match scoped to the requested user', async () => {
    const findExact = vi.fn(async (userId: string, normalized: string) =>
      userId === 'user-1' && normalized === 'bel marfer' ? match : null,
    )
    await expect(resolveCounterpartyAlias('user-1', 'Bel Márfer!', { findExact })).resolves.toEqual({
      ...match,
      match_type: 'exact',
    })
    await expect(resolveCounterpartyAlias('user-2', 'Bel Márfer!', { findExact })).resolves.toBeNull()
    await expect(resolveCounterpartyAlias('user-1', 'Bel Marfe', { findExact })).resolves.toBeNull()
  })

  it('suggests one existing profile when the detected wording is a whole-phrase subset', async () => {
    const existing = {
      ...match,
      alias_value: 'Alejandro La Briola',
      normalized_value: 'alejandro la briola',
      display_name: 'Alejandro La Briola',
      default_category: 'Alimentos' as const,
    }
    await expect(resolveCounterpartyAlias('user-1', 'La briola', {
      findExact: async () => null,
      findCandidates: async () => [existing],
    })).resolves.toEqual({ ...existing, match_type: 'suggestion' })
  })

  it('fails closed when a partial wording points to more than one profile', async () => {
    await expect(resolveCounterpartyAlias('user-1', 'La briola', {
      findExact: async () => null,
      findCandidates: async () => [
        { ...match, profile_id: 'profile-1', normalized_value: 'alejandro la briola' },
        { ...match, alias_id: 'alias-2', profile_id: 'profile-2', normalized_value: 'panaderia la briola' },
      ],
    })).resolves.toBeNull()
  })

  it('uses explicit edit, then alias, then parser suggestion without auto-confirming', () => {
    expect(applyCounterpartyResolution({
      parser: { description: 'BEL MARFER', category: 'Alimentos' },
      match,
      explicit: { description: 'Mi nombre', category: 'Otros' },
    })).toMatchObject({ description: 'Mi nombre', category: 'Otros', confirmed: false })

    expect(applyCounterpartyResolution({
      parser: { description: 'BEL MARFER', category: 'Alimentos' }, match,
    })).toMatchObject({ description: 'BEL MARFER', category: 'Supermercado', confirmed: false, alias_match: match })

    expect(applyCounterpartyResolution({
      parser: { description: 'Sin match', category: 'Alimentos' }, match: null,
    })).toMatchObject({ description: 'Sin match', category: 'Alimentos', confirmed: false, alias_match: null })
  })
})

describe('explicit remember outcome', () => {
  it('keeps confirmed expense successful when alias persistence fails', async () => {
    const confirmExpense = vi.fn(async () => ({ id: 'expense-1' }))
    const saveAlias = vi.fn(async () => { throw new Error('missing migration') })
    await expect(rememberCounterpartyAfterConfirmation({ confirmExpense, saveAlias, remember: true }))
      .resolves.toEqual({ expense: { id: 'expense-1' }, aliasSaved: false })
    expect(confirmExpense).toHaveBeenCalledOnce()
    expect(saveAlias).toHaveBeenCalledOnce()
  })

  it('does not persist when remember is off by default', async () => {
    const saveAlias = vi.fn()
    const result = await rememberCounterpartyAfterConfirmation({
      confirmExpense: async () => ({ id: 'expense-1' }), saveAlias, remember: false,
    })
    expect(result.aliasSaved).toBeNull()
    expect(saveAlias).not.toHaveBeenCalled()
  })
})

describe('migration contract', () => {
  const sql = readFileSync(new URL('../../docs/supabase-counterparty-aliases.sql', import.meta.url), 'utf8')

  it('separates profiles and aliases with ownership, exact uniqueness and safe sources', () => {
    expect(sql).toContain('create table if not exists public.counterparty_profiles')
    expect(sql).toContain('create table if not exists public.counterparty_aliases')
    expect(sql).toMatch(/unique\s*\(user_id, normalized_value\)/i)
    expect(sql).toContain('counterparty_profiles_name_idx')
    expect(sql).toContain("default_category is null or default_category in (")
    expect(sql).toContain("source in ('manual', 'receipt', 'parser')")
    expect(sql).toMatch(/enable row level security/i)
    expect(sql).toMatch(/auth\.uid\(\) = user_id/i)
    expect(sql).toMatch(/counterparty_alias_profile_same_user/i)
  })

  it('does not add financial identifiers or mutate historical expenses', () => {
    expect(sql).not.toMatch(/\b(cbu|cvu|cuit|cuil|installments|payment_rail|reference|card_id|account_id)\b/i)
    expect(sql).not.toMatch(/update\s+public\.expenses/i)
  })
})
