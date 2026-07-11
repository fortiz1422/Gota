/**
 * Lifecycle de señales (guía v1.1 §16): decide qué dedupeKeys se suprimen
 * según el historial persistido. Puro — la fila viene de insight_events.
 *
 * Reglas:
 * - señal nueva (sin fila): elegible;
 * - pospuesta (dismissed_until futuro): oculta, salvo que escale a risk y el
 *   snooze se haya tomado en un estado menor;
 * - resuelta o accionada: oculta (una nueva ocurrencia usa otro dedupeKey);
 * - feedback not_relevant: no vuelve como watch, solo como risk.
 */

export type InsightEventRow = {
  dedupe_key: string
  insight_kind: string
  shown_count: number
  dismissed_until: string | null
  acted_at: string | null
  resolved_at: string | null
  feedback: 'useful' | 'not_relevant' | 'not_now' | null
  last_status: 'calm' | 'watch' | 'risk' | null
}

export type LifecycleSuppressions = {
  /** Nunca mostrar esta ocurrencia. */
  suppressedKeys: string[]
  /** Mostrar solo si la señal llega en risk (escalación rompe el snooze). */
  suppressedUnlessRiskKeys: string[]
}

export function computeLifecycleSuppressions(
  events: InsightEventRow[],
  options: { now: string },
): LifecycleSuppressions {
  const suppressedKeys: string[] = []
  const suppressedUnlessRiskKeys: string[] = []

  for (const event of events) {
    if (event.resolved_at || event.acted_at) {
      suppressedKeys.push(event.dedupe_key)
      continue
    }
    const snoozeActive = Boolean(event.dismissed_until && event.dismissed_until > options.now)
    if (snoozeActive) {
      // Un snooze tomado ya en risk se respeta; uno menor lo rompe la escalada.
      if (event.last_status === 'risk') suppressedKeys.push(event.dedupe_key)
      else suppressedUnlessRiskKeys.push(event.dedupe_key)
      continue
    }
    if (event.feedback === 'not_relevant') {
      suppressedUnlessRiskKeys.push(event.dedupe_key)
    }
  }

  return { suppressedKeys, suppressedUnlessRiskKeys }
}
