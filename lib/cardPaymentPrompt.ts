import type { Account, Card } from '@/types/database'

export type ActiveDueCycle = {
  periodoDesde: Date
  periodoHasta: Date
  cycleKey: string // YYYY-MM-DD of periodoHasta (closing date)
}

export type PromptState = {
  dismissCount: number // 0, 1, or 2
  confirmed: boolean
}

function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Dado un card, retorna el ciclo activo de due si today está en la ventana.
 *
 * Ventana activa: today >= due_day && today <= fin de mes
 *
 * Si closing_day <= due_day:
 *   periodoHasta = closing_day del mes actual
 *   periodoDesde = closing_day del mes anterior
 *
 * Si closing_day > due_day:
 *   periodoHasta = closing_day del mes anterior
 *   periodoDesde = closing_day de dos meses atrás
 */
export function findActiveDueCycle(card: Card, today: Date): ActiveDueCycle | null {
  if (card.closing_day === null) return null

  const closingDay = card.closing_day
  const dueDay = card.due_day
  const todayDay = today.getDate()
  const todayMonth = today.getMonth() + 1 // 1-indexed
  const todayYear = today.getFullYear()

  // Check ventana: today >= due_day (same month), today <= end of month
  const lastDayOfMonth = new Date(todayYear, todayMonth, 0).getDate()
  if (todayDay < dueDay || todayDay > lastDayOfMonth) {
    return null
  }

  let periodoHasta: Date
  let periodoDesde: Date

  if (closingDay <= dueDay) {
    // closing happens before due in the same month
    // periodoHasta = closing_day of current month
    periodoHasta = new Date(todayYear, todayMonth - 1, closingDay)
    // periodoDesde = closing_day one month prior
    periodoDesde = new Date(todayYear, todayMonth - 2, closingDay)
  } else {
    // closing_day > due_day → closing happened in the previous month
    const prevMonthIdx = todayMonth - 2 // 0-indexed month of previous month
    periodoHasta = new Date(todayYear, prevMonthIdx, closingDay)
    periodoDesde = new Date(todayYear, prevMonthIdx - 1, closingDay)
  }

  const cycleKey = toYMD(periodoHasta)

  return { periodoDesde, periodoHasta, cycleKey }
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function storageKey(cardId: string, cycleKey: string): string {
  return `card_pago_${cardId}_${cycleKey}`
}

export function getPromptState(cardId: string, cycleKey: string): PromptState {
  try {
    const raw = localStorage.getItem(storageKey(cardId, cycleKey))
    if (!raw) return { dismissCount: 0, confirmed: false }
    const parsed = JSON.parse(raw) as { d?: number; c?: boolean }
    return { dismissCount: parsed.d ?? 0, confirmed: parsed.c ?? false }
  } catch {
    return { dismissCount: 0, confirmed: false }
  }
}

export function setPromptState(
  cardId: string,
  cycleKey: string,
  state: PromptState,
): void {
  try {
    localStorage.setItem(
      storageKey(cardId, cycleKey),
      JSON.stringify({ d: state.dismissCount, c: state.confirmed }),
    )
  } catch {
    // ignore quota / SSR errors
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Derivar payment_method del tipo de cuenta desde donde se paga la tarjeta */
export function paymentMethodFromAccountType(
  type: Account['type'],
): 'DEBIT' | 'TRANSFER' | 'CASH' {
  if (type === 'cash') return 'CASH'
  if (type === 'digital') return 'TRANSFER'
  return 'DEBIT' // bank
}
