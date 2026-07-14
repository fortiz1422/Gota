import { describe, expect, it } from 'vitest'
import { createSignalOccurrenceIdentity } from '../signal-occurrence-key'
import type { InsightCandidate } from '@/lib/intelligence/types'

function makeCandidate(overrides: Partial<InsightCandidate> = {}): InsightCandidate {
  return {
    id: 'raw-id:card-123',
    kind: 'upcoming_card_due',
    severity: 'watch',
    priority: 320,
    title: 'La tarjeta vence pronto',
    short: 'Vence en cuatro días',
    message: 'Tenés un resumen pendiente.',
    evidence: [],
    dataQuality: 'ok',
    actions: [],
    validUntil: '2026-07-18',
    dedupeKey: 'upcoming_card_due:raw-card-123:2026-07-18',
    ...overrides,
  }
}

describe('createSignalOccurrenceIdentity', () => {
  it('genera claves determinísticas y opacas para el mismo usuario y candidato', () => {
    const candidate = makeCandidate()

    const first = createSignalOccurrenceIdentity('user-123', candidate)
    const second = createSignalOccurrenceIdentity('user-123', candidate)

    expect(first).toEqual(second)
    expect(first.occurrenceKey).toMatch(/^sig_[a-f0-9]{64}$/)
    expect(first.version).toMatch(/^sigv_[a-f0-9]{64}$/)
    expect(JSON.stringify(first)).not.toContain(candidate.dedupeKey)
    expect(JSON.stringify(first)).not.toContain('raw-card-123')
    expect(JSON.stringify(first)).not.toContain('user-123')
  })

  it('separa ocurrencia y versión entre usuarios', () => {
    const first = createSignalOccurrenceIdentity('user-123', makeCandidate())
    const second = createSignalOccurrenceIdentity('user-456', makeCandidate())

    expect(second.occurrenceKey).not.toBe(first.occurrenceKey)
    expect(second.version).not.toBe(first.version)
  })

  it('mantiene la ocurrencia y cambia la versión cuando cambia su presentación', () => {
    const original = createSignalOccurrenceIdentity('user-123', makeCandidate())
    const updated = createSignalOccurrenceIdentity(
      'user-123',
      makeCandidate({ title: 'La tarjeta vence mañana', severity: 'risk', priority: 450 }),
    )

    expect(updated.occurrenceKey).toBe(original.occurrenceKey)
    expect(updated.version).not.toBe(original.version)
  })

  it('mantiene la versión cuando cambian solo campos técnicos no publicados', () => {
    const original = createSignalOccurrenceIdentity(
      'user-123',
      makeCandidate({
        evidence: [
          { id: 'private-1', label: 'Pendiente', value: '$ 50.000', source: 'card:private-1' },
        ],
        actions: [
          { label: 'Ver compromisos', href: '/analytics?drill=compromisos' },
          { label: 'Acción privada', question: 'No publicada' },
        ],
      }),
    )
    const privateFieldsChanged = createSignalOccurrenceIdentity(
      'user-123',
      makeCandidate({
        id: 'another-internal-id',
        evidence: [
          { id: 'private-2', label: 'Pendiente', value: '$ 50.000', source: 'card:private-2' },
        ],
        actions: [
          { label: 'Ver compromisos', href: '/analytics?drill=compromisos' },
          { label: 'Otra acción privada', question: 'Tampoco publicada' },
        ],
      }),
    )

    expect(privateFieldsChanged.occurrenceKey).toBe(original.occurrenceKey)
    expect(privateFieldsChanged.version).toBe(original.version)
  })

  it('mantiene una salida fija para detectar cambios accidentales del esquema', () => {
    expect(createSignalOccurrenceIdentity('user-123', makeCandidate())).toEqual({
      occurrenceKey: 'sig_ff15e2f28b9935da2b68f533be054a8311a0362e9d84a8eb8847aa527f73763f',
      version: 'sigv_53fec66b3b8948023f32a86a7a7a42ee4df62274e99764e82e0d8cb9c16aafbf',
    })
  })
})
