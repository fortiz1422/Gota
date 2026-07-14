import type { SignalBellTone } from './signal-center'
import type { InsightSeverity } from './types'

export const SIGNALS_READ_STORAGE_KEY = 'gota.signals.read_versions.v1'

const MAX_READ_VERSIONS = 100
const OPAQUE_VERSION = /^sigv_[a-f0-9]{64}$/

type SignalReadStorage = Pick<Storage, 'getItem' | 'setItem'>
type VersionedSignal = { version: string }
type ToneSignal = VersionedSignal & { severity: InsightSeverity }

function opaqueVersions(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return values.filter(
    (value): value is string =>
      typeof value === 'string' && OPAQUE_VERSION.test(value),
  )
}

export function loadReadSignalVersions(storage: SignalReadStorage): string[] {
  try {
    const serialized = storage.getItem(SIGNALS_READ_STORAGE_KEY)
    if (!serialized) return []
    return [...new Set(opaqueVersions(JSON.parse(serialized)))].slice(
      0,
      MAX_READ_VERSIONS,
    )
  } catch {
    return []
  }
}

export function markSignalVersionsRead(
  storage: SignalReadStorage,
  versions: readonly string[],
): string[] {
  const next = [...loadReadSignalVersions(storage)]
  for (const version of versions) {
    if (!OPAQUE_VERSION.test(version) || next.includes(version)) continue
    next.unshift(version)
  }

  const capped = next.slice(0, MAX_READ_VERSIONS)
  try {
    storage.setItem(SIGNALS_READ_STORAGE_KEY, JSON.stringify(capped))
  } catch {
    // localStorage puede estar bloqueado o sin cuota; el estado en memoria sigue siendo útil.
  }
  return capped
}

export function countUnreadSignals(
  signals: readonly VersionedSignal[],
  readVersions: readonly string[],
): number {
  const read = new Set(readVersions)
  return signals.reduce(
    (count, signal) => count + (read.has(signal.version) ? 0 : 1),
    0,
  )
}

export function highestUnreadSignalTone(
  signals: readonly ToneSignal[],
  readVersions: readonly string[],
): SignalBellTone {
  const read = new Set(readVersions)
  let tone: SignalBellTone = 'none'

  for (const signal of signals) {
    if (read.has(signal.version)) continue
    if (signal.severity === 'risk') return 'risk'
    if (signal.severity === 'watch') tone = 'watch'
    else if (tone === 'none') tone = 'new'
  }

  return tone
}
