export const INITIAL_IMPORT_PRESETS = ['today', '30d', '90d'] as const
export type InitialImportPreset = typeof INITIAL_IMPORT_PRESETS[number]

/** Import the selected Argentine calendar period, never a future timestamp. */
export function initialImportWindow(preset: InitialImportPreset, now = new Date()) {
  if (!INITIAL_IMPORT_PRESETS.includes(preset) || !Number.isFinite(now.getTime())) throw new Error('invalid_initial_import')
  const offset = 3 * 60 * 60 * 1000
  const local = new Date(now.getTime() - offset)
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + offset
  const days = preset === 'today' ? 1 : preset === '30d' ? 30 : 90
  return { beginTimestamp: new Date(localMidnight - (days - 1) * 86400000).toISOString(), endTimestamp: now.toISOString() }
}
