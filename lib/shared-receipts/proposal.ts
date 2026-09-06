import { z } from 'zod'
import { CATEGORIES } from '@/lib/validation/schemas'

export const RECEIPT_TRANSACTION_TYPES = [
  'purchase',
  'income',
  'own_transfer',
  'third_party_transfer',
  'card_payment',
  'refund',
  'yield',
  'unknown',
] as const

const nullableText = z.string().trim().max(160).nullable().default(null)

export const ReceiptProposalSchema = z.object({
  transaction_type: z.enum(RECEIPT_TRANSACTION_TYPES),
  amount: z.number().positive().finite().nullable().default(null),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().default(null),
  occurred_at: z.iso.datetime({ offset: true }).nullable().default(null),
  merchant_or_counterparty: nullableText,
  payment_rail: z
    .enum(['cash', 'card', 'debit_card', 'credit_card', 'bank_transfer', 'wallet', 'unknown'])
    .nullable()
    .default(null),
  account_hint: nullableText,
  card_last_four: z.string().regex(/^\d{4}$/).nullable().default(null),
  installments: z.number().int().min(1).max(72).nullable().default(null),
  reference: nullableText,
  category_suggestion: z.enum(CATEGORIES).nullable().default(null),
  confidence: z.number().min(0).max(1).default(0),
  warnings: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  evidence: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
})

export type ReceiptProposal = z.infer<typeof ReceiptProposalSchema>

export function parseReceiptProposal(input: unknown): ReceiptProposal {
  return ReceiptProposalSchema.parse(input)
}

const SENSITIVE_PATTERNS = [
  /\b(?:\d[ -]?){12,19}\b/g, // Full payment card numbers.
  /\b\d{22}\b/g, // CBU/CVU.
  /\b\d{2}-?\d{8}-?\d\b/g, // CUIT/CUIL.
  /\b[A-Z0-9]{16,}\b/gi, // Long operation/reference identifiers.
]

function redactSensitiveText(value: string | null): string | null {
  if (value === null) return null
  return SENSITIVE_PATTERNS.reduce(
    (sanitized, pattern) => sanitized.replace(pattern, '[REDACTED]'),
    value,
  )
}

export function sanitizeReceiptProposal(proposal: ReceiptProposal): ReceiptProposal {
  return {
    ...proposal,
    merchant_or_counterparty: redactSensitiveText(proposal.merchant_or_counterparty),
    account_hint: redactSensitiveText(proposal.account_hint),
    reference: redactSensitiveText(proposal.reference),
    warnings: proposal.warnings.map((value) => redactSensitiveText(value) ?? ''),
    evidence: proposal.evidence.map((value) => redactSensitiveText(value) ?? ''),
  }
}
