import type { HeroBalanceMode } from '@/types/database'
import type { Currency } from './types'

/**
 * Contexto de display del Home: cómo el usuario está viendo los números
 * (moneda, modo combinado, masking). El brief nunca debe contradecirlo.
 */
export type HomeDisplayContext = {
  heroBalanceMode: HeroBalanceMode
  viewCurrency: Currency
  /** Cotización vigente para modo combinado; null si no hay quote válida. */
  valuationRate: number | null
  amountsVisible: boolean
}

export type HomeMoneyBasis = {
  mode: HeroBalanceMode
  currency: Currency
  valuationRate: number | null
}

/**
 * Resuelve la base monetaria del brief en un solo lugar: modo combinado solo
 * si hay cotización válida; si no, fallback explícito a la moneda default.
 */
export function resolveMoneyBasis(context: HomeDisplayContext): HomeMoneyBasis {
  if (context.heroBalanceMode === 'combined_ars' && context.valuationRate !== null) {
    return { mode: 'combined_ars', currency: 'ARS', valuationRate: context.valuationRate }
  }
  if (context.heroBalanceMode === 'combined_usd' && context.valuationRate !== null) {
    return { mode: 'combined_usd', currency: 'USD', valuationRate: context.valuationRate }
  }
  return { mode: 'default_currency', currency: context.viewCurrency, valuationRate: null }
}

/** Reemplaza todo monto formateado ('$ 1.234', 'USD 1.234,56') por '•••'. */
export function maskAmounts(text: string): string {
  return text.replace(/(?:USD|U\$S?|\$)\s?[\d.,]+/g, '•••')
}
