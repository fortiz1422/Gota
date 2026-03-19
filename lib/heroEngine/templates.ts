import { formatAmount } from '@/lib/format'
import type { HeroThread, HeroEngineInput, Chip, Sentiment } from './types'

// ─── Text templates ───────────────────────────────────────────────────────────
// Each entry: [templateString, sentiment]

export const TEMPLATES: Record<HeroThread, [string, Sentiment][]> = {
  fresh_start: [
    ['Arranca [mes]. Pizarra limpia, todo por delante.', 'neutral'],
    ['[Mes] empieza hoy. Lo que pasó el mes pasado ya cerró.', 'neutral'],
    ['Primera semana. Todavía no hay nada que analizar — hay todo que construir.', 'neutral'],
  ],

  big_expense_echo: [
    ['Hoy entró un gasto grande en [bigExpenseCategory]. El mes sigue, pero el mapa cambió.', 'neutral'],
    ['[bigExpenseCategory] se llevó [bigExpenseAmount] hoy. Un solo movimiento puede reconfigurar la lectura del mes.', 'neutral'],
    ['Hubo un movimiento importante hoy — [bigExpenseCategory], [bigExpenseAmount]. Todo sigue igual, salvo el margen.', 'neutral'],
  ],

  subscription_incoming: [
    ['Todavía no debitaron [pendingCount] suscripciones este mes. Ese dinero ya tiene dueño.', 'neutral'],
    ['Hay [pendingCount] servicios pendientes de débito — [pendingAmount] que todavía no impactaron en tu cuenta.', 'neutral'],
    ['Antes de que cierre el mes, [pendingCount] suscripciones todavía van a pasar. [pendingAmount] comprometido.', 'neutral'],
  ],

  category_spike: [
    ['[spikeCategory] se llevó el [spikeShare]% del gasto total este mes. Más de lo habitual.', 'neutral'],
    ['Mirando el mes, [spikeCategory] se despegó — [spikeTxCount] veces, [spikeCategoryAmount] en total.', 'neutral'],
    ['El mes tiene cara de [spikeCategory]. Esa categoría concentró más peso del que suele tener.', 'neutral'],
  ],

  debit_vs_credit_shift: [
    ['Esta semana el [creditRatioWeek]% de los gastos fue con tarjeta — más que el [creditRatioMonth]% del mes. Algo cambió.', 'neutral'],
    ['El mix de medios cambió esta semana. El crédito subió más de lo habitual.', 'neutral'],
    ['Más tarjeta de lo normal esta semana. [creditRatioWeek]% en crédito, contra [creditRatioMonth]% del promedio del mes.', 'neutral'],
  ],

  deseo_overload: [
    ['El [deseoPercent]% de lo que gastaste este mes fue en deseos. No es un juicio — es el dato.', 'neutral'],
    ['Más de la mitad del gasto del mes estuvo en la columna Deseo.', 'neutral'],
    ['Este mes tuvo más deseos que necesidades. [deseoPercent]% en lo que querías, [necesidadPercent]% en lo que necesitabas.', 'neutral'],
  ],

  closing_alert: [
    ['En [daysToClosing] días cierra [cardName]. Lo que acumulaste hasta hoy es lo que vas a pagar.', 'neutral'],
    ['[cardName] cierra el [closingDate]. Llevás [cardCommitted] cargado este mes.', 'neutral'],
    ['Faltan [daysToClosing] días para el cierre de [cardName]. [cardCommitted] acumulados hasta ahora.', 'neutral'],
  ],

  card_closing_heavy: [
    ['[cardName] cierra en [daysToClosing] días con [cardCommitted] — más de lo habitual para esta tarjeta.', 'alert'],
    ['Este mes le cargaste más de lo normal a [cardName]. [cardCommitted] acumulados, cierra en [daysToClosing] días.', 'alert'],
    ['De lo que comprometiste en [cardName] este mes, el [cardTopCategoryShare]% fue en [cardTopCategory]. Cierra pronto.', 'alert'],
  ],

  recurring_creep: [
    ['Tus recurrentes suman [recurringTotal] este mes. El [recurringPercent]% del ingreso se va antes de que decidas nada.', 'neutral'],
    ['Hay [recurringTotal] que debitan solos cada mes — [recurringCount] servicios, todo automático.', 'neutral'],
    ['El [recurringPercent]% del ingreso ya tiene destino fijo. Suscripciones, recurrentes — todo sin que lo notes.', 'neutral'],
  ],

  pace_alarm: [
    ['El ritmo actual está por encima de lo que entra. Quedan [daysLeft] días para ajustar.', 'alert'],
    ['Vas un poco más rápido de lo que el mes permite. El margen se achica.', 'alert'],
    ['Al ritmo actual, el mes cierra con [projectedDeficit] negativo. Todavía hay margen para corregir.', 'alert'],
  ],

  good_rhythm: [
    ['El mes viene bien. Ritmo controlado, nada fuera de lugar.', 'positive'],
    ['Sin estridencias. Gastos ordenados, margen saludable.', 'positive'],
    ['Este mes no tiene drama — y eso, a veces, es todo.', 'positive'],
  ],

  pace_tense_ending: [
    ['El mes cierra en rojo — [projectedDeficit] negativo. Ya casi no hay margen para cambiar el resultado.', 'alert'],
    ['Quedan [daysLeft] días y el mes no cierra bien. Fue así.', 'alert'],
    ['La proyección es [projectedDeficit] negativo al cierre. No es el mes que arrancaste, pero es información para el próximo.', 'alert'],
  ],

  pace_good_ending: [
    ['El mes cierra bien. Quedan [daysLeft] días y la proyección es [projectedBalance] positivo.', 'positive'],
    ['Con [daysLeft] días por delante, el mes va a cerrar en verde.', 'positive'],
    ['Este mes estuvo bien manejado. La proyección final: [projectedBalance] disponible.', 'positive'],
  ],

  neutral_mid: [
    ['El mes transcurre. [topCategoryName] concentra el mayor gasto hasta ahora — [topCategoryAmount].', 'neutral'],
    ['[dayOfMonth] días adentro, ritmo estable. Nada que alarme por el momento.', 'neutral'],
    ['[monthName] en marcha. Lo más relevante hasta ahora: [topCategoryName], [topCategoryAmount], [topCategoryTxCount] transacciones.', 'neutral'],
  ],
}

// ─── Pill 1 — tied to the winning thread ─────────────────────────────────────

function fmt(amount: number, currency: 'ARS' | 'USD'): string {
  return formatAmount(Math.round(Math.abs(amount)), currency)
}

export const PILL1: Record<HeroThread, (s: HeroEngineInput) => Chip> = {
  fresh_start: (s) => ({
    label:
      s.monthlyIncome > 0
        ? `Ingreso del mes · ${fmt(s.monthlyIncome, s.currency)}`
        : `${s.monthName} · día ${s.dayOfMonth}`,
    emphasis: 'neutral',
  }),
  big_expense_echo: (s) => ({
    label: `${s.bigExpenseCategory} · ${fmt(s.bigExpenseAmount, s.currency)} hoy`,
    emphasis: 'neutral',
  }),
  subscription_incoming: (s) => ({
    label: `${s.pendingSubscriptions!.count} suscripciones · ${fmt(s.pendingSubscriptions!.estimatedAmount, s.currency)}`,
    emphasis: 'neutral',
  }),
  category_spike: (s) => ({
    label: `${s.categorySpike!.name} · ${Math.round(s.categorySpike!.share * 100)}% del total`,
    emphasis: 'neutral',
  }),
  debit_vs_credit_shift: (s) => ({
    label: `Crédito esta semana · ${Math.round(s.creditRatioThisWeek * 100)}% (vs ${Math.round(s.creditRatio * 100)}% del mes)`,
    emphasis: 'neutral',
  }),
  deseo_overload: (s) => ({
    label: `${Math.round(s.deseoRatio * 100)}% del gasto en deseos`,
    emphasis: 'warning',
  }),
  closing_alert: (s) => ({
    label: `${s.closingCards[0].name} · ${fmt(s.closingCards[0].committed, s.currency)} acumulado`,
    emphasis: 'neutral',
  }),
  card_closing_heavy: (s) => ({
    label: `${s.closingCards[0].name} · cierra en ${s.closingCards[0].daysToClosing} días`,
    emphasis: 'warning',
  }),
  recurring_creep: (s) => ({
    label: `${s.recurringCount} recurrentes · ${fmt(s.recurringTotal, s.currency)} por mes`,
    emphasis: 'neutral',
  }),
  pace_alarm: (s) => ({
    label: `Ritmo actual · ${fmt(s.dailyRate, s.currency)} por día`,
    emphasis: 'warning',
  }),
  good_rhythm: (s) => ({
    label: `Ritmo actual · ${fmt(s.dailyRate, s.currency)} por día`,
    emphasis: 'positive',
  }),
  pace_tense_ending: (s) => ({
    label: `Cierre proyectado · ${fmt(Math.abs(s.projectedBalance), s.currency)} en rojo`,
    emphasis: 'warning',
  }),
  pace_good_ending: (s) => ({
    label: `Cierre proyectado · ${fmt(s.projectedBalance, s.currency)} disponible`,
    emphasis: 'positive',
  }),
  neutral_mid: (s) => ({
    label: `${s.topCategory.name} · ${Math.round(s.topCategory.share * 100)}% del gasto`,
    emphasis: 'neutral',
  }),
}

// ─── Pills 2 & 3 — scored pool, not redundant with thread ────────────────────

type PillSignal =
  | 'small_expenses_drain'
  | 'daily_average_trend'
  | 'commitment_ratio'
  | 'deseo_ratio_snapshot'
  | 'next_debit_incoming'

const SIGNAL_AXIS: Record<PillSignal, string> = {
  small_expenses_drain: 'goteo',
  daily_average_trend: 'pace',
  commitment_ratio: 'commitments',
  deseo_ratio_snapshot: 'deseo',
  next_debit_incoming: 'subscriptions',
}

const EXCLUDED_BY_THREAD: Partial<Record<HeroThread, PillSignal[]>> = {
  deseo_overload: ['deseo_ratio_snapshot'],
  subscription_incoming: ['next_debit_incoming'],
  pace_alarm: ['daily_average_trend'],
  pace_tense_ending: ['daily_average_trend'],
  pace_good_ending: ['daily_average_trend'],
  recurring_creep: ['commitment_ratio', 'next_debit_incoming'],
}

export function buildPills23(s: HeroEngineInput, thread: HeroThread): Chip[] {
  const candidates: { signal: PillSignal; score: number; pill: Chip }[] = []

  // Goteo
  if (s.goteoRatio > 0.30) {
    candidates.push({
      signal: 'small_expenses_drain',
      score: 60 + (s.goteoRatio - 0.30) * 200,
      pill: {
        label: `${s.goteoCount} gastos chicos · ${Math.round(s.goteoRatio * 100)}% del total`,
        emphasis: s.goteoRatio > 0.40 ? 'warning' : 'neutral',
      },
    })
  }

  // Weekly trend vs monthly avg
  if (s.dailyRate > 0 && s.weeklyAvg > 0) {
    const delta = ((s.weeklyAvg / s.dailyRate) - 1) * 100
    if (Math.abs(delta) > 15) {
      candidates.push({
        signal: 'daily_average_trend',
        score: delta > 0 ? 65 : 40,
        pill: {
          label: delta > 0
            ? `Semana cara · ${Math.round(delta)}% sobre el promedio`
            : `Semana tranquila · ${Math.round(Math.abs(delta))}% bajo el promedio`,
          emphasis: delta > 20 ? 'warning' : delta < -15 ? 'positive' : 'neutral',
        },
      })
    }
  }

  // Recurring commitment ratio
  if (s.recurringRatio > 0.25) {
    candidates.push({
      signal: 'commitment_ratio',
      score: s.recurringRatio > 0.35 ? 90 : 70,
      pill: {
        label: `Fijos mensuales · ${Math.round(s.recurringRatio * 100)}% del ingreso`,
        emphasis: s.recurringRatio > 0.30 ? 'warning' : 'neutral',
      },
    })
  }

  // Deseo snapshot
  if (s.deseoRatio > 0.40) {
    candidates.push({
      signal: 'deseo_ratio_snapshot',
      score: 50 + (s.deseoRatio - 0.40) * 150,
      pill: {
        label: `Deseos este mes · ${Math.round(s.deseoRatio * 100)}% del total`,
        emphasis: s.deseoRatio > 0.55 ? 'warning' : 'neutral',
      },
    })
  }

  // Next subscription debit
  if (s.pendingSubscriptions && s.pendingSubscriptions.nextDebitDays <= 3) {
    candidates.push({
      signal: 'next_debit_incoming',
      score: 45,
      pill: {
        label: `${s.pendingSubscriptions.names[0]} · debita en ${s.pendingSubscriptions.nextDebitDays} días`,
        emphasis: 'neutral',
      },
    })
  }

  candidates.sort((a, b) => b.score - a.score)

  const excluded = EXCLUDED_BY_THREAD[thread] ?? []
  const filtered = candidates.filter((c) => !excluded.includes(c.signal))

  // No two signals from the same axis
  const winners: typeof filtered = []
  for (const c of filtered) {
    if (winners.length >= 2) break
    const sameAxis = winners.some((w) => SIGNAL_AXIS[w.signal] === SIGNAL_AXIS[c.signal])
    if (!sameAxis) winners.push(c)
  }

  return winners.map((w) => w.pill)
}
