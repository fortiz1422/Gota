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

function probeWindow(now: Date): { from: string; to: string } {
  const from = new Date(now)
  from.setUTCHours(0, 0, 0, 0)
  const to = new Date(now)
  to.setUTCHours(23, 59, 59, 999)
  return { from: from.toISOString(), to: to.toISOString() }
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
  const paymentsQuery = new URLSearchParams({
    sort: 'date_created',
    criteria: 'desc',
    range: 'date_created',
    begin_date: from,
    end_date: to,
    limit: String(PROBE_LIMIT),
    offset: '0',
  })
  return Promise.all([
    runProbe({ name: 'user', path: '/users/me', accessToken: params.accessToken, fetchImpl }),
    runProbe({ name: 'settlement_reports', path: '/v1/account/settlement_report/list', accessToken: params.accessToken, fetchImpl }),
    runProbe({ name: 'payments', path: `/v1/payments/search?${paymentsQuery}`, accessToken: params.accessToken, fetchImpl }),
  ])
}
