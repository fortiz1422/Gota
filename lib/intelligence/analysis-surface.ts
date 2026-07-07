import type { IntelligenceHero } from './heroes'

export type AnalysisIntelligencePresentation = {
  takeover: IntelligenceHero | null
  chips: IntelligenceHero[]
}

const MAX_CHIPS = 3

/**
 * Presentación para Análisis mobile: el hero azul ya narra el gasto observado
 * vs promedio same-day, así que `same_day_spend_delta` no se repite acá.
 * Una señal de severidad risk toma el headline del hero azul; el resto va
 * como chips compactos bajo la blue zone.
 */
export function resolveAnalysisPresentation(
  heroes: IntelligenceHero[],
): AnalysisIntelligencePresentation {
  const relevant = heroes.filter((hero) => hero.kind !== 'same_day_spend_delta')
  const takeover = relevant.find((hero) => hero.severity === 'risk') ?? null
  const chips = relevant.filter((hero) => hero !== takeover).slice(0, MAX_CHIPS)
  return { takeover, chips }
}

/** Línea de subcopy para el hero azul cuando una señal toma el headline. */
export function takeoverSubcopy(hero: IntelligenceHero): string {
  return hero.evidence
    .slice(0, 2)
    .map((item) => `${item.label} ${item.value}`)
    .join(' · ')
}
