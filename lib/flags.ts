/**
 * Feature flags — controlados por env vars.
 * FF_YIELD queda activo por default porque la migración de rendimientos diarios
 * ya está aplicada en producción. Setear NEXT_PUBLIC_FF_YIELD='false' para ocultarlo.
 */
export const FF_YIELD       = process.env.NEXT_PUBLIC_FF_YIELD       !== 'false'
export const FF_INSTRUMENTS = process.env.NEXT_PUBLIC_FF_INSTRUMENTS === 'true'
export const FF_GOTA_ASSISTANT =
  process.env.FF_GOTA_ASSISTANT === 'true' ||
  process.env.NEXT_PUBLIC_FF_GOTA_ASSISTANT === 'true'
/**
 * Capa de inteligencia (héroes + evidencia). Determinística y de solo
 * lectura, por eso arranca activa. Setear NEXT_PUBLIC_FF_INTELLIGENCE='false'
 * para apagarla.
 */
export const FF_INTELLIGENCE = process.env.NEXT_PUBLIC_FF_INTELLIGENCE !== 'false'
