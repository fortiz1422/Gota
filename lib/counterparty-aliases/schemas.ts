import { z } from 'zod'
import { CATEGORIES } from '@/lib/validation/schemas'
import { normalizeCounterpartyAlias } from './normalize'

const DisplayName = z.string().trim().min(1).max(100)
const DefaultCategory = z.enum(CATEGORIES).nullable().optional()
const AliasSource = z.enum(['manual', 'receipt', 'parser'])
const AliasValue = z.string().trim().min(1).max(160)

export const ProfileCreateSchema = z.object({
  display_name: DisplayName,
  default_category: DefaultCategory,
}).strict()

export const ProfilePatchSchema = z.object({
  display_name: DisplayName.optional(),
  default_category: DefaultCategory,
}).strict().refine((value) => Object.keys(value).length > 0)

export const AliasCreateSchema = z.object({
  alias_value: AliasValue,
  source: AliasSource.default('manual'),
}).strict().transform((value, context) => {
  try {
    return { ...value, normalized_value: normalizeCounterpartyAlias(value.alias_value) }
  } catch (error) {
    context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Invalid alias' })
    return z.NEVER
  }
})

export const AliasPatchSchema = z.object({
  profile_id: z.uuid().optional(),
  alias_value: AliasValue.optional(),
  source: AliasSource.optional(),
}).strict().refine((value) => Object.keys(value).length > 0).transform((value, context) => {
  if (!value.alias_value) return value
  try {
    return { ...value, normalized_value: normalizeCounterpartyAlias(value.alias_value) }
  } catch (error) {
    context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : 'Invalid alias' })
    return z.NEVER
  }
})

export const ResolveAliasSchema = z.object({ alias_value: AliasValue }).strict()

export function aliasErrorResponse(error: unknown): { status: number; body: { error: string } } {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
  if (code === '23505') return { status: 409, body: { error: 'alias_already_assigned' } }
  if (code === '23503') return { status: 404, body: { error: 'profile_not_found' } }
  return { status: 500, body: { error: 'counterparty_alias_error' } }
}
