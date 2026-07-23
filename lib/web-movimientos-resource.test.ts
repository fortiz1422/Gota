import { describe, expect, it } from 'vitest'
import {
  resolveMovementsResource,
  resolveSelectedMovementId,
  type MovementsResource,
} from './web-movimientos-resource'
import type { ApiMovement } from '@/components/dashboard/desktop/movimientos-data'

const previous = [{ kind: 'expense', data: { id: 'old' } }] as ApiMovement[]

describe('resolveMovementsResource', () => {
  it('does not expose movements from a previous month while the next month loads', () => {
    const resource: MovementsResource = {
      key: '2026-06:0',
      movements: previous,
      failed: false,
    }

    expect(resolveMovementsResource(resource, '2026-07:0')).toEqual({
      movements: [],
      loading: true,
      failed: false,
    })
  })

  it('exposes only the response matching the current request key', () => {
    const resource: MovementsResource = {
      key: '2026-07:1',
      movements: previous,
      failed: false,
    }

    expect(resolveMovementsResource(resource, '2026-07:1')).toEqual({
      movements: previous,
      loading: false,
      failed: false,
    })
  })

  it('does not reopen a selection from a previous request key', () => {
    expect(resolveSelectedMovementId(
      { key: '2026-06:0', id: 'expense:old' },
      '2026-07:0',
    )).toBeNull()
    expect(resolveSelectedMovementId(
      { key: '2026-07:0', id: 'expense:current' },
      '2026-07:0',
    )).toBe('expense:current')
  })
})
