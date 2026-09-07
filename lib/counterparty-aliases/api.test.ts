import { describe, expect, it } from 'vitest'
import {
  AliasCreateSchema,
  AliasPatchSchema,
  ProfileCreateSchema,
  ProfilePatchSchema,
  aliasErrorResponse,
} from './schemas'

describe('counterparty profile API contract', () => {
  it('accepts canonical categories and rejects arbitrary or client ownership fields', () => {
    expect(ProfileCreateSchema.safeParse({ display_name: 'Belmar', default_category: 'Supermercado' }).success).toBe(true)
    expect(ProfileCreateSchema.safeParse({ display_name: 'Belmar', default_category: 'Compras' }).success).toBe(false)
    expect(ProfileCreateSchema.safeParse({ display_name: 'Belmar', user_id: 'another-user' }).success).toBe(false)
    expect(ProfilePatchSchema.safeParse({}).success).toBe(false)
  })

  it('bounds and normalizes aliases while allowing explicit reassignment', () => {
    expect(AliasCreateSchema.parse({ alias_value: ' BÉL-MARFER ', source: 'receipt' })).toMatchObject({
      alias_value: 'BÉL-MARFER', source: 'receipt', normalized_value: 'bel marfer',
    })
    expect(AliasCreateSchema.safeParse({ alias_value: '---', source: 'manual' }).success).toBe(false)
    expect(AliasPatchSchema.parse({ profile_id: '10000000-0000-4000-8000-000000000001' }).profile_id).toBeTruthy()
  })

  it('maps exact uniqueness violations to an explicit conflict', () => {
    expect(aliasErrorResponse({ code: '23505' })).toEqual({ status: 409, body: { error: 'alias_already_assigned' } })
    expect(aliasErrorResponse({ code: 'other' }).status).toBe(500)
  })
})
