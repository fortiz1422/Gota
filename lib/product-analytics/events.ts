export const PRODUCT_EVENT_NAMES = [
  'onboarding_started',
  'onboarding_completed',
  'first_account_created',
  'first_expense_created',
  'smartinput_parse_started',
  'smartinput_parse_succeeded',
  'smartinput_parse_failed',
  'parsepreview_confirmed',
  'parsepreview_cancelled',
  'anonymous_banner_seen',
  'anonymous_link_started',
  'anonymous_link_completed',
  'card_payment_prompt_seen',
  'card_payment_prompt_confirmed',
  'card_payment_prompt_dismissed',
  'dashboard_loaded_with_data',
] as const

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number]
export type ProductEventValue = string | number | boolean | null
export type ProductEventProperties = Record<string, ProductEventValue>

const SENSITIVE_KEY_PATTERNS = [
  /amount/i,
  /balance/i,
  /category/i,
  /description/i,
  /email/i,
  /input/i,
  /monto/i,
  /name/i,
  /password/i,
  /saldo/i,
  /token/i,
]

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

function sanitizeValue(value: ProductEventValue): ProductEventValue {
  if (typeof value !== 'string') return value
  return value.length > 120 ? `${value.slice(0, 120)}...` : value
}

export function sanitizeEventProperties(
  properties: ProductEventProperties = {},
): ProductEventProperties {
  const safeEntries = Object.entries(properties)
    .filter(([key]) => !isSensitiveKey(key))
    .slice(0, 24)
    .map(([key, value]) => [key.slice(0, 64), sanitizeValue(value)] as const)

  return Object.fromEntries(safeEntries)
}

export function isProductEventName(value: string): value is ProductEventName {
  return PRODUCT_EVENT_NAMES.includes(value as ProductEventName)
}
