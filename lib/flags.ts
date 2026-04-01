/**
 * Feature flags — controlados por env vars.
 * En local (.env.local): setear a 'true' para activar.
 * En Vercel prod: dejar sin setear (defaultean a false → feature oculta).
 */
export const FF_YIELD       = process.env.NEXT_PUBLIC_FF_YIELD       === 'true'
export const FF_INSTRUMENTS = process.env.NEXT_PUBLIC_FF_INSTRUMENTS === 'true'
