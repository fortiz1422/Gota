export type MovimientosMainPanel = 'skeleton' | 'error' | 'list'

/** Decide qué panel principal mostrar debajo de los filtros (sin reglas de negocio). */
export function resolveMovimientosMainPanel(
  isLoading: boolean,
  fetchError: boolean
): MovimientosMainPanel {
  if (isLoading) return 'skeleton'
  if (fetchError) return 'error'
  return 'list'
}
