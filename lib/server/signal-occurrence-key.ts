import { createHash } from 'node:crypto'
import type { SignalOccurrenceIdentity } from '@/lib/intelligence/signal-center'
import type { InsightCandidate } from '@/lib/intelligence/types'

const HASH_LENGTH = 40

function opaqueHash(prefix: 'sig' | 'sigv', value: string): string {
  const digest = createHash('sha256').update(value, 'utf8').digest('hex')
  return `${prefix}_${digest.slice(0, HASH_LENGTH)}`
}

/**
 * Convierte la identidad editorial interna en tokens opacos aptos para el
 * contrato público y localStorage. La ocurrencia sobrevive a cambios de copy;
 * la versión cambia cuando cambia cualquier parte visible de la señal.
 */
export function createSignalOccurrenceIdentity(
  candidate: Readonly<InsightCandidate>,
): SignalOccurrenceIdentity {
  const presentation = JSON.stringify({
    kind: candidate.kind,
    severity: candidate.severity,
    priority: candidate.priority,
    title: candidate.title,
    short: candidate.short,
    message: candidate.message,
    evidence: candidate.evidence,
    dataQuality: candidate.dataQuality,
    actions: candidate.actions,
    validUntil: candidate.validUntil,
  })

  return {
    occurrenceKey: opaqueHash('sig', candidate.dedupeKey),
    version: opaqueHash('sigv', `${candidate.dedupeKey}\u0000${presentation}`),
  }
}
