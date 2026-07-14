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
  it('genera claves determinísticas y opacas sin filtrar identificadores crudos', () => {
    const candidate = makeCandidate()

    const first = createSignalOccurrenceIdentity(candidate)
    const second = createSignalOccurrenceIdentity(candidate)

    expect(first).toEqual(second)
    expect(first.occurrenceKey).toMatch(/^sig_[a-f0-9]{40}$/)
    expect(first.version).toMatch(/^sigv_[a-f0-9]{40}$/)
    expect(JSON.stringify(first)).not.toContain(candidate.dedupeKey)
    expect(JSON.stringify(first)).not.toContain('raw-card-123')
  })

  it('mantiene la ocurrencia y cambia la versión cuando cambia su presentación', () => {
    const original = createSignalOccurrenceIdentity(makeCandidate())
    const updated = createSignalOccurrenceIdentity(
      makeCandidate({ title: 'La tarjeta vence mañana', severity: 'risk', priority: 450 }),
    )

    expect(updated.occurrenceKey).toBe(original.occurrenceKey)
    expect(updated.version).not.toBe(original.version)
  })
})
