import { describe, expect, it } from 'vitest'
import {
  SIGNALS_READ_STORAGE_KEY,
  countUnreadSignals,
  highestUnreadSignalTone,
  loadReadSignalVersions,
  markSignalVersionsRead,
} from '../signals-read-state'

function version(index: number): string {
  return `sigv_${index.toString(16).padStart(64, '0')}`
}

function memoryStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(SIGNALS_READ_STORAGE_KEY, initial)
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  }
}

describe('estado local de lectura de señales', () => {
  it('usa la clave versionada exacta del contrato', () => {
    expect(SIGNALS_READ_STORAGE_KEY).toBe('gota.signals.read_versions.v1')
  })

  it('calcula el tono unread con precedencia risk, watch, new y none', () => {
    const signals = [
      { version: version(1), severity: 'info' as const },
      { version: version(2), severity: 'positive' as const },
      { version: version(3), severity: 'watch' as const },
      { version: version(4), severity: 'risk' as const },
    ]

    expect(highestUnreadSignalTone(signals, [])).toBe('risk')
    expect(highestUnreadSignalTone(signals, [version(4)])).toBe('watch')
    expect(highestUnreadSignalTone(signals, [version(3), version(4)])).toBe('new')
    expect(highestUnreadSignalTone(signals, signals.map(({ version }) => version))).toBe('none')
    expect(highestUnreadSignalTone([], [])).toBe('none')
  })

  it('persiste solo versiones opacas, deduplicadas y recientes', () => {
    const storage = memoryStorage()

    const saved = markSignalVersionsRead(storage, [version(1), 'raw-dedupe-key', version(2), version(1)])

    expect(saved).toEqual([version(2), version(1)])
    expect(loadReadSignalVersions(storage)).toEqual(saved)
    expect(storage.getItem(SIGNALS_READ_STORAGE_KEY)).not.toContain('raw-dedupe-key')
  })

  it('conserva como máximo las cien versiones más recientes', () => {
    const storage = memoryStorage()
    const versions = Array.from({ length: 105 }, (_, index) => version(index))

    const saved = markSignalVersionsRead(storage, versions)

    expect(saved).toHaveLength(100)
    expect(saved[0]).toBe(version(104))
    expect(saved.at(-1)).toBe(version(5))
  })

  it('tolera storage corrupto y cuenta unread por versión', () => {
    const storage = memoryStorage('{not-json')

    expect(loadReadSignalVersions(storage)).toEqual([])
    expect(
      countUnreadSignals(
        [{ version: version(1) }, { version: version(2) }, { version: 'raw-version' }],
        [version(1)],
      ),
    ).toBe(2)
  })

  it('degrada a vacío cuando getItem lanza', () => {
    const storage = {
      getItem: () => {
        throw new Error('storage bloqueado')
      },
      setItem: () => undefined,
    }

    expect(() => loadReadSignalVersions(storage)).not.toThrow()
    expect(loadReadSignalVersions(storage)).toEqual([])
  })

  it('devuelve el estado en memoria sin lanzar cuando setItem falla', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('cuota excedida')
      },
    }

    expect(() => markSignalVersionsRead(storage, [version(1)])).not.toThrow()
    expect(markSignalVersionsRead(storage, [version(1)])).toEqual([version(1)])
  })
})
