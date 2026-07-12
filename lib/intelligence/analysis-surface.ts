import type { IntelligenceHero } from './heroes'

export type AnalysisIntelligencePresentation = {
  takeover: IntelligenceHero | null
  chips: IntelligenceHero[]
}

const MAX_CHIPS = 3

/**
 * Presentación para Análisis mobile: el hero azul ya narra el gasto observado
 * vs promedio same-day, así que `same_day_spend_delta` no se repite acá.
 * Las señales de otros dominios no reemplazan ese hero: vencimientos,
 * liquidez y compromisos ya tienen su superficie propietaria en Home. Evita
 * mezclar un headline de tarjeta con el monto principal de gasto de Análisis.
 */
export function resolveAnalysisPresentation(
  heroes: IntelligenceHero[],
): AnalysisIntelligencePresentation {
  const relevant = heroes.filter((hero) => hero.kind !== 'same_day_spend_delta')
  return { takeover: null, chips: relevant.slice(0, MAX_CHIPS) }
}

/** Línea de subcopy para el hero azul cuando una señal toma el headline. */
export function takeoverSubcopy(hero: IntelligenceHero): string {
  return hero.evidence
    .slice(0, 2)
    .map((item) => `${item.label} ${item.value}`)
    .join(' · ')
}
