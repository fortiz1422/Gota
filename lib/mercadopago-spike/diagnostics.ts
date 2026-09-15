export const DIAGNOSTIC_FIELDS = [
  'paging',
  'results',
  'id',
  'status',
  'type',
  'date_created',
  'date_last_updated',
  'total',
  'next_offset',
] as const

export type ProbeDiagnostic = {
  status: number | null
  ok: boolean
  payloadType: 'array' | 'object' | 'null' | 'scalar' | 'unreadable'
  count: number | null
  fields: string[]
  error: string | null
}

export function buildDiagnosticPayload(probes: Array<{
  name: string
  method: string
  path: string
  diagnostic: ProbeDiagnostic
}>) {
  return {
    status: 'diagnostic' as const,
    read_only: true as const,
    probes: probes.map(({ name, method, path, diagnostic }) => ({ name, method, path, ...diagnostic })),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function inferCount(payload: unknown): number | null {
  if (Array.isArray(payload)) return payload.length
  if (!isRecord(payload)) return null
  if (Array.isArray(payload.results)) return payload.results.length
  if (typeof payload.total === 'number' && Number.isInteger(payload.total) && payload.total >= 0) return payload.total
  if (isRecord(payload.paging) && typeof payload.paging.total === 'number' && Number.isInteger(payload.paging.total)) {
    return payload.paging.total
  }
  return null
}

export function sanitizeProbeDiagnostic(params: {
  status: number | null
  payload: unknown
  error?: string | null
}): ProbeDiagnostic {
  const { payload } = params
  const payloadType = Array.isArray(payload)
    ? 'array'
    : payload === null
      ? 'null'
      : typeof payload === 'object'
        ? 'object'
        : payload === undefined
          ? 'unreadable'
          : 'scalar'
  const fields = isRecord(payload)
    ? Object.keys(payload).filter((field) => DIAGNOSTIC_FIELDS.includes(field as typeof DIAGNOSTIC_FIELDS[number])).sort()
    : []

  return {
    status: params.status,
    ok: params.status !== null && params.status >= 200 && params.status < 300,
    payloadType,
    count: inferCount(payload),
    fields,
    error: params.error ?? null,
  }
}

export function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : 'probe_failed'
  return raw
    .replace(/authorization\s*:\s*bearer\s+[^\s"']+/gi, 'authorization: [REDACTED]')
    .replace(/bearer\s+[^\s"']+/gi, 'bearer [REDACTED]')
    .replace(/(access_token|refresh_token|client_secret)\s*[=:]\s*[^\s,&"']+/gi, '$1=[REDACTED]')
    .slice(0, 160)
}
