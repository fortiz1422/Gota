const API = 'https://api.mercadopago.com'
const BEGIN_DATE = '2026-09-15T03:00:00Z'
const END_DATE = '2026-09-16T02:59:59Z'
const WINDOW = { begin_date: BEGIN_DATE, end_date: END_DATE }

export type SettlementProbeConnection = { access_token_ciphertext: string | null }
export type SettlementProbeClassification = 'none' | 'invalid_begin_date' | 'invalid_end_date' | 'end_date_before_begin_date' | 'invalid_parameters' | 'capability_denied' | 'unclassified_provider_error' | 'non_json_or_empty'
export type SettlementProbeResult = { stage: 'connection' | 'list' | 'create'; httpStatus: number | null; accepted: boolean; classification: SettlementProbeClassification; reportStatus?: string; hasFile?: boolean; providerCode?: string }
type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

type ProviderError = { status: number; payload: unknown; json: boolean }
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const scalar = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : undefined

function classification(payload: unknown, json: boolean): SettlementProbeClassification {
  if (!json || payload === null || payload === '') return 'non_json_or_empty'
  const text = JSON.stringify(payload).toLowerCase()
  if (text.includes('invalid_begin_date') || text.includes('invalid begin date') || text.includes('begin_date is invalid')) return 'invalid_begin_date'
  if (text.includes('invalid_end_date') || text.includes('invalid end date') || text.includes('end_date is invalid')) return 'invalid_end_date'
  if (text.includes('end_date_before_begin_date') || text.includes('end date before begin date')) return 'end_date_before_begin_date'
  if (text.includes('invalid_parameters') || text.includes('invalid parameters')) return 'invalid_parameters'
  if (text.includes('capability') || text.includes('not permitted') || text.includes('forbidden')) return 'capability_denied'
  return 'unclassified_provider_error'
}

async function readResponse(response: Response): Promise<{ payload: unknown; json: boolean }> {
  const text = await response.text()
  if (!text.trim()) return { payload: null, json: false }
  try { return { payload: JSON.parse(text), json: true } } catch { return { payload: text, json: false } }
}

async function providerResult(response: Response, stage: 'list' | 'create'): Promise<SettlementProbeResult | null> {
  if (response.ok) return null
  const { payload, json } = await readResponse(response)
  const error: ProviderError = { status: response.status, payload, json }
  const record = isRecord(error.payload) ? error.payload : null
  const providerCode = record ? scalar(record.code) : undefined
  return { stage, httpStatus: error.status, accepted: false, classification: classification(error.payload, error.json), ...(providerCode && /^[A-Za-z0-9_.-]{1,64}$/.test(providerCode) ? { providerCode } : {}) }
}

function authInit(token: string, method = 'GET', body?: string): RequestInit {
  return { method, cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body } : {}) }
}

function exactReport(payload: unknown): Record<string, unknown> | null {
  const items = Array.isArray(payload) ? payload : isRecord(payload) && Array.isArray(payload.reports) ? payload.reports : []
  return items.find((item) => isRecord(item) && item.begin_date === BEGIN_DATE && item.end_date === END_DATE) as Record<string, unknown> | null ?? null
}

export async function runSettlementProbe({ connections, decrypt, fetchImpl = fetch }: { connections: SettlementProbeConnection[]; decrypt: (ciphertext: string) => string; fetchImpl?: FetchLike }): Promise<SettlementProbeResult> {
  if (connections.length !== 1 || !connections[0].access_token_ciphertext) return { stage: 'connection', httpStatus: null, accepted: false, classification: 'unclassified_provider_error' }
  let token: string
  try { token = decrypt(connections[0].access_token_ciphertext) } catch { return { stage: 'connection', httpStatus: null, accepted: false, classification: 'unclassified_provider_error' } }

  const listResponse = await fetchImpl(`${API}/v1/account/settlement_report/list`, authInit(token))
  const listError = await providerResult(listResponse, 'list')
  if (listError) return listError
  const list = await readResponse(listResponse)
  if (!list.json) return { stage: 'list', httpStatus: listResponse.status, accepted: false, classification: 'non_json_or_empty' }
  const report = exactReport(list.payload)
  if (report) {
    const reportStatus = scalar(report.status ?? report.state)
    return { stage: 'list', httpStatus: listResponse.status, accepted: false, classification: 'none', ...(reportStatus ? { reportStatus } : {}), hasFile: typeof report.file_name === 'string' && report.file_name.length > 0 }
  }

  const createResponse = await fetchImpl(`${API}/v1/account/settlement_report`, authInit(token, 'POST', JSON.stringify(WINDOW)))
  const createError = await providerResult(createResponse, 'create')
  if (createError) return createError
  return { stage: 'create', httpStatus: createResponse.status, accepted: createResponse.status === 202, classification: 'none' }
}

export { BEGIN_DATE, END_DATE }
