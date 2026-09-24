const DAY = 24 * 60 * 60 * 1000
const AR_OFFSET_MS = 3 * 60 * 60 * 1000

export const SYNC_PRESETS = ['7d', '30d', '60d', 'custom', 'since_last_full_sync'] as const
export const MAX_CUSTOM_SYNC_DAYS = 60
export const MAX_SINCE_FULL_SYNC_DAYS = 365
export type SyncPreset = (typeof SYNC_PRESETS)[number]
export type SyncWindow = { preset: SyncPreset; beginDate: string; endDate: string; beginTimestamp: string; endTimestamp: string }

type Input = { preset?: unknown; beginDate?: unknown; endDate?: unknown; [key: string]: unknown }

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null
}

function argentinaDate(now: Date): Date {
  const shifted = new Date(now.getTime() - AR_OFFSET_MS)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}

export function windowFromDates(beginDate: Date, endDate: Date, preset: SyncPreset): SyncWindow {
  const beginTimestamp = new Date(beginDate.getTime() + AR_OFFSET_MS).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const endTimestamp = new Date(endDate.getTime() + DAY + AR_OFFSET_MS - 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
  return { preset, beginDate: beginDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10), beginTimestamp, endTimestamp }
}

export function parseSyncWindow(input: Input | null | undefined, now = new Date(), sinceLastFullSync?: string | null): SyncWindow {
  const value = input ?? {}
  const keys = Object.keys(value)
  if (keys.some((key) => !['preset', 'beginDate', 'endDate'].includes(key))) throw new Error('invalid_sync_schema')
  const preset = value.preset === undefined ? '7d' : value.preset
  if (typeof preset !== 'string' || !SYNC_PRESETS.includes(preset as SyncPreset)) throw new Error('invalid_sync_preset')
  const lastDay = argentinaDate(now)
  let begin: Date
  let end = lastDay
  if (preset === 'custom') {
    const parsedBegin = parseDate(value.beginDate)
    const parsedEnd = parseDate(value.endDate)
    if (!parsedBegin || !parsedEnd) throw new Error('invalid_sync_dates')
    begin = parsedBegin
    end = parsedEnd
  } else if (preset === 'since_last_full_sync') {
    const parsed = parseDate(sinceLastFullSync ?? null)
    if (!parsed) throw new Error('no_complete_sync')
    begin = new Date(parsed.getTime() + DAY)
  } else {
    if (value.beginDate !== undefined || value.endDate !== undefined) throw new Error('invalid_sync_schema')
    const days = Number(preset.slice(0, -1))
    begin = new Date(lastDay.getTime() - (days - 1) * DAY)
  }
  if (begin > end) throw new Error('invalid_sync_range')
  if (begin > lastDay || end > lastDay) throw new Error('future_sync_range')
  const length = Math.round((end.getTime() - begin.getTime()) / DAY) + 1
  if (length > (preset === 'since_last_full_sync' ? MAX_SINCE_FULL_SYNC_DAYS : MAX_CUSTOM_SYNC_DAYS)) throw new Error('sync_range_too_large')
  return windowFromDates(begin, end, preset as SyncPreset)
}

export function parseSyncRequestBody(body: unknown): Input {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_sync_schema')
  return body as Input
}
