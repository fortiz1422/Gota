export const SHARED_RECEIPT_ROUTES = {
  devices: '/api/shared-receipt-devices',
  device: (id: string) => `/api/shared-receipt-devices/${encodeURIComponent(id)}`,
  inbox: '/api/shared-receipts?status=needs_review',
  apiDetail: (id: string) => `/api/shared-receipts/${encodeURIComponent(id)}`,
  review: (id: string) => `/shared-receipts/${encodeURIComponent(id)}`,
  analyze: (id: string, retry = false) => `/api/shared-receipts/${encodeURIComponent(id)}/analyze${retry ? '?retry=true' : ''}`,
  confirm: (id: string) => `/api/shared-receipts/${encodeURIComponent(id)}/confirm`,
  dismiss: (id: string) => ({
    url: `/api/shared-receipts/${encodeURIComponent(id)}`,
    method: 'DELETE' as const,
  }),
} as const

type SharedReceiptCacheInvalidator = {
  invalidateQueries: (filters: { queryKey: string[] }) => Promise<unknown>
}

export async function invalidateAfterSharedReceiptConfirmation(
  queryClient: SharedReceiptCacheInvalidator,
): Promise<void> {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['account-breakdown'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['shared-receipts'] }),
  ])
}

export interface SharedReceiptDevice {
  id: string
  name: string
  created_at: string
  expires_at?: string | null
  revoked_at?: string | null
  last_used_at?: string | null
}

export function buildSharedReceiptDeviceCreatePayload(name: string): { label: string } {
  return { label: name.trim() }
}

export interface SharedReceiptSummary {
  id: string
  status: string
  created_at: string
  filename?: string | null
  content_type?: string | null
  duplicate?: boolean
  parsed_payload?: unknown
  image_url?: string | null
}

export interface PurchaseProposal {
  transaction_type: 'purchase'
  description: string
  amount: number
  date: string
  currency: 'ARS' | 'USD'
  category: string
  account_id: string | null
  card_id: string | null
  installments: number
  payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
  card_last_four: string | null
  card_brand: string | null
  is_want: boolean | null
}

export type ParsedPurchaseProposal =
  | { supported: true; proposal: PurchaseProposal }
  | { supported: false; reason: string }

function unwrapArray<T>(value: unknown, key: string): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') {
    const nested = (value as Record<string, unknown>)[key]
    if (Array.isArray(nested)) return nested as T[]
  }
  return []
}

function normalizeDevice(value: unknown): SharedReceiptDevice | null {
  const raw = asRecord(value)
  if (!raw) return null
  const id = typeof raw.id === 'string' ? raw.id : ''
  const name = typeof raw.name === 'string'
    ? raw.name
    : typeof raw.label === 'string' ? raw.label : ''
  const createdAt = typeof raw.created_at === 'string' ? raw.created_at : ''
  if (!id || !name || !createdAt) return null
  return {
    id,
    name,
    created_at: createdAt,
    ...(typeof raw.expires_at === 'string' ? { expires_at: raw.expires_at } : {}),
    ...(typeof raw.revoked_at === 'string' ? { revoked_at: raw.revoked_at } : {}),
    ...(typeof raw.last_used_at === 'string'
      ? { last_used_at: raw.last_used_at }
      : typeof raw.last_seen_at === 'string' ? { last_used_at: raw.last_seen_at } : {}),
  }
}

export function normalizeDevicesResponse(value: unknown): SharedReceiptDevice[] {
  return unwrapArray<unknown>(value, 'devices')
    .map(normalizeDevice)
    .filter((device): device is SharedReceiptDevice => device !== null)
}

export function extractCreatedDevice(value: unknown): { device: SharedReceiptDevice; token: string } {
  const response = asRecord(value) ?? {}
  const nestedDevice = asRecord(response.device)
  const rawDevice = nestedDevice ?? response
  const device = normalizeDevice(rawDevice)
  const token = typeof response.token === 'string'
    ? response.token
    : typeof response.secret === 'string'
      ? response.secret
      : null
  if (!device || !token) {
    throw new Error('La API no devolvió el token de única visualización.')
  }
  return { device, token }
}

export function normalizeReceiptsResponse(value: unknown): SharedReceiptSummary[] {
  return unwrapArray<SharedReceiptSummary>(value, 'receipts')
}

export function getNextPendingReceiptId(
  receipts: SharedReceiptSummary[],
  currentReceiptId: string,
): string | null {
  return receipts.find((receipt) => receipt.id !== currentReceiptId)?.id ?? null
}

export function getReceiptQueuePosition(
  receipts: SharedReceiptSummary[],
  currentReceiptId: string,
): { current: number; total: number } {
  const index = receipts.findIndex((receipt) => receipt.id === currentReceiptId)
  return { current: index >= 0 ? index + 1 : 1, total: receipts.length }
}

export function normalizeReceiptResponse(value: unknown): SharedReceiptSummary | null {
  const envelope = asRecord(value)
  const receipt = asRecord(envelope?.receipt) ?? normalizeReceiptsResponse(value)[0] ?? envelope
  if (!receipt || typeof receipt.id !== 'string' || typeof receipt.status !== 'string' || typeof receipt.created_at !== 'string') {
    return null
  }
  return receipt as unknown as SharedReceiptSummary
}

export function getShortcutInstallState(url: string | undefined):
  | { available: false; label: 'Plantilla todavía no publicada' }
  | { available: true; label: 'Instalar Shortcut'; url: string } {
  const trimmed = url?.trim()
  return trimmed
    ? { available: true, label: 'Instalar Shortcut', url: trimmed }
    : { available: false, label: 'Plantilla todavía no publicada' }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

export function parsePurchaseProposal(value: unknown): ParsedPurchaseProposal {
  const envelope = asRecord(value)
  const raw = asRecord(envelope?.proposal) ?? envelope ?? {}
  const type = raw.transaction_type
  if (type !== 'purchase' && type !== 'third_party_transfer') {
    return {
      supported: false,
      reason: 'Este tipo de comprobante todavía no se puede confirmar automáticamente.',
    }
  }

  const amount = typeof raw.amount === 'number' ? raw.amount : Number(raw.amount)
  const description = typeof raw.merchant_or_counterparty === 'string'
    ? raw.merchant_or_counterparty.trim()
    : ''
  const occurredAt = typeof raw.occurred_at === 'string' ? raw.occurred_at : ''
  const category = typeof raw.category_suggestion === 'string' ? raw.category_suggestion : ''
  if (!description || !Number.isFinite(amount) || !occurredAt || !raw.currency) {
    return { supported: false, reason: 'La propuesta está incompleta. Volvé a analizar el comprobante.' }
  }

  const paymentMethod = type === 'third_party_transfer' ? 'TRANSFER'
    : raw.payment_rail === 'credit_card' ? 'CREDIT'
    : raw.payment_rail === 'debit_card' ? 'DEBIT'
      : raw.payment_rail === 'bank_transfer' ? 'TRANSFER'
        : raw.payment_rail === 'cash' ? 'CASH' : 'DEBIT'

  return {
    supported: true,
    proposal: {
      transaction_type: 'purchase',
      description,
      amount,
      date: occurredAt.slice(0, 10),
      currency: raw.currency === 'USD' ? 'USD' : 'ARS',
      category,
      account_id: null,
      card_id: null,
      installments: Math.max(1, Number(raw.installments) || 1),
      payment_method: paymentMethod,
      card_last_four: typeof raw.card_last_four === 'string' ? raw.card_last_four : null,
      card_brand: typeof raw.card_brand === 'string' ? raw.card_brand.trim() || null : null,
      is_want: null,
    },
  }
}

type ReceiptCardCandidate = {
  id: string
  name: string
  last_four?: string | null
  archived?: boolean
}

function normalizeCardLabel(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function matchReceiptCard(
  cards: ReceiptCardCandidate[],
  lastFour: string | null,
  brand: string | null,
): ReceiptCardCandidate | null {
  const availableCards = cards.filter((card) => !card.archived)
  if (lastFour) {
    const suffixMatches = availableCards.filter((card) => card.last_four === lastFour)
    if (suffixMatches.length === 1) return suffixMatches[0]
  }
  if (!brand) return null
  const normalizedBrand = normalizeCardLabel(brand.trim())
  if (!normalizedBrand) return null
  const brandMatches = availableCards.filter((card) => normalizeCardLabel(card.name).includes(normalizedBrand))
  return brandMatches.length === 1 ? brandMatches[0] : null
}

export function restoreStoredPurchaseProposal(
  receipt: SharedReceiptSummary,
  cards: ReceiptCardCandidate[],
): ParsedPurchaseProposal | null {
  if (receipt.status !== 'needs_review' || !receipt.parsed_payload) return null
  const parsed = parsePurchaseProposal(receipt.parsed_payload)
  if (!parsed.supported) return parsed
  if (parsed.proposal.payment_method !== 'CREDIT') return parsed
  const matchingCard = matchReceiptCard(cards, parsed.proposal.card_last_four, parsed.proposal.card_brand)
  if (!matchingCard) return parsed
  return {
    supported: true,
    proposal: { ...parsed.proposal, card_id: matchingCard.id },
  }
}

export interface ConfirmPurchaseForm {
  description: string
  amount: string | number
  date: string
  currency: 'ARS' | 'USD'
  category: string
  account_id?: string | null
  card_id?: string | null
  installments: string | number
  payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
  is_want: boolean | null
  user_id?: unknown
}

export type ConfirmPurchasePayload = Omit<PurchaseProposal, 'card_last_four' | 'card_brand'>

export function buildConfirmPurchasePayload(form: ConfirmPurchaseForm): ConfirmPurchasePayload {
  const amount = typeof form.amount === 'number' ? form.amount : Number(form.amount)
  const installments = typeof form.installments === 'number' ? form.installments : Number(form.installments)
  if (!form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.date || !form.category) {
    throw new Error('Completá descripción, monto, fecha y categoría.')
  }
  if (!Number.isInteger(installments) || installments < 1) {
    throw new Error('Las cuotas deben ser un número entero mayor a cero.')
  }
  return {
    transaction_type: 'purchase',
    description: form.description.trim(),
    amount,
    date: form.date,
    currency: form.currency,
    category: form.category,
    account_id: form.account_id || null,
    card_id: form.card_id || null,
    installments,
    payment_method: form.payment_method,
    is_want: form.is_want,
  }
}

export function parseConfirmResult(value: unknown): { duplicate: boolean; expenseId: string | null } {
  const result = asRecord(value) ?? {}
  const expense = asRecord(result.expense)
  const expenseId = typeof result.expense_id === 'string'
    ? result.expense_id
    : typeof expense?.id === 'string'
      ? expense.id
      : null
  return {
    duplicate: result.duplicate === true || result.idempotent === true || result.already_confirmed === true,
    expenseId,
  }
}

export type LastFourValidation =
  | { valid: true; value: string | null }
  | { valid: false; message: string }

export function validateCardLastFour(value: string): LastFourValidation {
  const trimmed = value.trim()
  if (!trimmed) return { valid: true, value: null }
  if (/^\d{4}$/.test(trimmed)) return { valid: true, value: trimmed }
  return { valid: false, message: 'Ingresá exactamente 4 dígitos.' }
}

export function buildCardLastFourPayload(value: string): { last_four: string | null } {
  const result = validateCardLastFour(value)
  if (!result.valid) throw new Error(result.message)
  return { last_four: result.value }
}
