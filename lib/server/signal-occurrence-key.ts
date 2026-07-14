import { createHash } from 'node:crypto'
import {
  projectSignalPresentation,
  type SignalOccurrenceIdentity,
} from '@/lib/intelligence/signal-center'
import type { InsightCandidate } from '@/lib/intelligence/types'

function opaqueHash(prefix: 'sig' | 'sigv', value: string): string {
  const digest = createHash('sha256').update(value, 'utf8').digest('hex')
  return `${prefix}_${digest}`
}

function delimited(parts: readonly string[]): string {
  return parts
    .map((part) => `${Buffer.byteLength(part, 'utf8')}:${part}`)
    .join('|')
}

/**
 * Convierte la identidad editorial interna en tokens opacos aptos para el
 * contrato público y localStorage. La ocurrencia sobrevive a cambios de copy;
 * la versión cambia cuando cambia cualquier parte visible de la señal.
 */
export function createSignalOccurrenceIdentity(
  userId: string,
  candidate: Readonly<InsightCandidate>,
): SignalOccurrenceIdentity {
  const presentation = JSON.stringify(projectSignalPresentation(candidate))

  const occurrenceKey = opaqueHash(
    'sig',
    delimited(['occurrence:v1', userId, candidate.dedupeKey]),
  )

  return {
    occurrenceKey,
    version: opaqueHash(
      'sigv',
      delimited(['version:v1', occurrenceKey, presentation]),
    ),
  }
}
