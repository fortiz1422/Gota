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

/**
 * Home ambiental (guía v1.1): arrancan apagadas hasta pasar QA visual.
 * Rollback = apagar la flag; el Home vuelve al estado estable sin migraciones.
 */
export const FF_HOME_AMBIENT_INTELLIGENCE_V1 =
  process.env.NEXT_PUBLIC_FF_HOME_AMBIENT_INTELLIGENCE_V1 === 'true'
export const FF_HOME_TRANSIENT_ACTION_V1 =
  process.env.NEXT_PUBLIC_FF_HOME_TRANSIENT_ACTION_V1 === 'true'
export const FF_MOVEMENT_ANNOTATIONS_V1 =
  process.env.NEXT_PUBLIC_FF_MOVEMENT_ANNOTATIONS_V1 === 'true'
export const FF_INTELLIGENCE_LIFECYCLE_V1 =
  process.env.NEXT_PUBLIC_FF_INTELLIGENCE_LIFECYCLE_V1 === 'true'
export const FF_SIGNALS_CENTER_V1 =
  process.env.NEXT_PUBLIC_FF_SIGNALS_CENTER_V1 === 'true'

/**
 * Workspace navegable de Análisis. Apagado por defecto para conservar el
 * modal Explorar como rollback exacto hasta completar el QA productivo.
 */
export const FF_ANALYTICS_WORKSPACE_V1 =
  process.env.NEXT_PUBLIC_FF_ANALYTICS_WORKSPACE_V1 === 'true'
