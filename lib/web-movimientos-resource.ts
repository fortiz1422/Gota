import type { ApiMovement } from '@/components/dashboard/desktop/movimientos-data'

export type MovementsResource = {
  key: string
  movements: ApiMovement[]
  failed: boolean
}

export type MovementSelection = {
  key: string
  id: string | null
}

export function resolveSelectedMovementId(
  selection: MovementSelection,
  requestKey: string,
): string | null {
  return selection.key === requestKey ? selection.id : null
}

export function resolveMovementsResource(
  resource: MovementsResource,
  requestKey: string,
): { movements: ApiMovement[]; loading: boolean; failed: boolean } {
  if (resource.key !== requestKey) {
    return { movements: [], loading: true, failed: false }
  }

  return {
    movements: resource.movements,
    loading: false,
    failed: resource.failed,
  }
}
