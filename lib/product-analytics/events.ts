export const PRODUCT_EVENT_NAMES = [
  'onboarding_started',
  'onboarding_completed',
  'first_account_created',
  'first_expense_created',
  'smartinput_parse_started',
  'smartinput_parse_succeeded',
  'smartinput_parse_failed',
  'smartinput_voice_started',
  'smartinput_voice_succeeded',
  'smartinput_voice_failed',
  'smartinput_voice_record_started',
  'smartinput_voice_record_succeeded',
  'smartinput_voice_record_failed',
  'parsepreview_confirmed',
  'parsepreview_cancelled',
  'anonymous_banner_seen',
  'anonymous_link_started',
  'anonymous_link_completed',
  'anonymous_upgrade_existing_account_selected',
  'card_payment_prompt_seen',
  'card_payment_prompt_confirmed',
  'card_payment_prompt_dismissed',
  'dashboard_loaded_with_data',
  'share_target_received',
  'share_target_ready',
  'share_target_failed',
  'share_target_preview_opened',
  'share_target_continue_requested',
  'share_target_parse_started',
  'share_target_parse_succeeded',
  'share_target_dismissed',
  'ambient_modifier_seen',
  'ambient_explanation_opened',
  'home_action_seen',
  'home_action_clicked',
  'home_action_completed',
  'home_action_dismissed',
  'home_action_snoozed',
  'intelligence_feedback_submitted',
  'simulation_started',
  'simulation_completed',
  'signals_bell_clicked',
  'signals_center_opened',
  'signals_signal_opened',
  'signals_coverage_opened',
  'signals_action_clicked',
] as const

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number]
export type ProductEventValue = string | number | boolean | null
export type ProductEventProperties = Record<string, ProductEventValue>

type SignalsProductEventName = Extract<ProductEventName, `signals_${string}`>

const SIGNAL_EVENT_PROPERTY_ALLOWLIST: Record<
  SignalsProductEventName,
  readonly string[]
> = {
  signals_bell_clicked: ['surface', 'has_unread'],
  signals_center_opened: ['source', 'surface', 'has_unread'],
  signals_signal_opened: ['signal_kind', 'severity', 'source'],
  signals_coverage_opened: ['coverage_id', 'coverage_state', 'source'],
  signals_action_clicked: ['signal_kind', 'action_type', 'source'],
}

const SIGNAL_KINDS = [
  'budget_acceleration',
  'same_day_spend_delta',
  'upcoming_card_due',
  'liquidity_watch',
  'recent_unusual_movement',
  'installment_load',
  'wants_creep',
  'goal_pace',
  'income_missing',
  'subscription_load',
] as const

const SIGNAL_DOMAINS = [
  'liquidity',
  'cards',
  'budget',
  'pace',
  'unusual',
  'installments',
  'wants',
  'goals',
  'income',
  'subscriptions',
] as const

const SIGNAL_EVENT_PROPERTY_VALUES: Record<
  SignalsProductEventName,
  Record<string, readonly ProductEventValue[]>
> = {
  signals_bell_clicked: {
    surface: ['home'],
    has_unread: [true, false],
  },
  signals_center_opened: {
    source: ['bell'],
    surface: ['home'],
    has_unread: [true, false],
  },
  signals_signal_opened: {
    signal_kind: SIGNAL_KINDS,
    severity: ['risk', 'watch', 'info', 'positive'],
    source: ['center'],
  },
  signals_coverage_opened: {
    coverage_id: ['all', ...SIGNAL_DOMAINS],
    coverage_state: ['active', 'learning', 'needs_setup', 'not_applicable'],
    source: ['center'],
  },
  signals_action_clicked: {
    signal_kind: SIGNAL_KINDS,
    action_type: ['navigate', 'ask'],
    source: ['center'],
  },
}

const SENSITIVE_KEY_PATTERNS = [
  /amount/i,
  /balance/i,
  /category/i,
  /description/i,
  /email/i,
  /evidence/i,
  /input/i,
  /message/i,
  /monto/i,
  /name/i,
  /password/i,
  /saldo/i,
  /title/i,
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
  eventName?: ProductEventName,
): ProductEventProperties {
  const signalAllowlist = eventName?.startsWith('signals_')
    ? SIGNAL_EVENT_PROPERTY_ALLOWLIST[eventName as SignalsProductEventName]
    : undefined
  const signalValues = eventName?.startsWith('signals_')
    ? SIGNAL_EVENT_PROPERTY_VALUES[eventName as SignalsProductEventName]
    : undefined

  const safeEntries = Object.entries(properties)
    .filter(([key]) => !signalAllowlist || signalAllowlist.includes(key))
    .filter(([key, value]) => !signalValues || signalValues[key]?.includes(value))
    .filter(([key]) => !isSensitiveKey(key))
    .slice(0, 24)
    .map(([key, value]) => [key.slice(0, 64), sanitizeValue(value)] as const)

  return Object.fromEntries(safeEntries)
}

export function isProductEventName(value: string): value is ProductEventName {
  return PRODUCT_EVENT_NAMES.includes(value as ProductEventName)
}
