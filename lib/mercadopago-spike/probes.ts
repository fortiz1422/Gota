import { sanitizeError, sanitizeProbeDiagnostic, type ProbeDiagnostic } from './diagnostics'

const API_BASE = 'https://api.mercadopago.com'
const PROBE_LIMIT = 5

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export type ProbeResult = {
  name: 'user' | 'settlement_reports' | 'payments'
  method: 'GET'
  path: string
  diagnostic: ProbeDiagnostic
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function probeWindow(now: Date): { from: string; to: string } {
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return { from: dateOnly(from), to: dateOnly(now) }
}

async function readPayload(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

async function runProbe(params: {
  name: ProbeResult['name']
  path: string
  accessToken: string
  fetchImpl: FetchLike
}): Promise<ProbeResult> {
  try {
    const response = await params.fetchImpl(`${API_BASE}${params.path}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${params.accessToken}` },
    })
    const payload = await readPayload(response)
    return {
      name: params.name,
      method: 'GET',
      path: params.path,
      diagnostic: sanitizeProbeDiagnostic({ status: response.status, payload }),
    }
  } catch (error) {
    return {
      name: params.name,
      method: 'GET',
      path: params.path,
      diagnostic: sanitizeProbeDiagnostic({ status: null, payload: undefined, error: sanitizeError(error) }),
    }
  }
}

export async function runReadOnlyProbes(params: {
  accessToken: string
  now?: Date
  fetchImpl?: FetchLike
}): Promise<ProbeResult[]> {
  const fetchImpl = params.fetchImpl ?? fetch
  const { from, to } = probeWindow(params.now ?? new Date())
  const query = new URLSearchParams({ limit: String(PROBE_LIMIT), offset: '0', begin_date: from, end_date: to })
  const paymentsQuery = new URLSearchParams({ limit: String(PROBE_LIMIT), offset: '0', sort: 'date_created', criteria: 'desc', date_created_from: `${from}T00:00:00Z`, date_created_to: `${to}T23:59:59Z` })
  return Promise.all([
    runProbe({ name: 'user', path: '/users/me', accessToken: params.accessToken, fetchImpl }),
    runProbe({ name: 'settlement_reports', path: `/v1/account/settlement_report/list?${query}`, accessToken: params.accessToken, fetchImpl }),
    runProbe({ name: 'payments', path: `/v1/payments/search?${paymentsQuery}`, accessToken: params.accessToken, fetchImpl }),
  ])
}
