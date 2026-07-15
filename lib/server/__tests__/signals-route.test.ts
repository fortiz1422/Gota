import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  flagEnabled: true,
  captureRouteError: vi.fn(),
  checkRateLimit: vi.fn(),
  createClient: vi.fn(),
  getUser: vi.fn(),
  loadIntelligenceSignals: vi.fn(),
}))

vi.mock('@/lib/flags', () => ({
  get FF_SIGNALS_CENTER_V1() {
    return mocks.flagEnabled
  },
}))
vi.mock('@/lib/observability/sentry', () => ({
  captureRouteError: mocks.captureRouteError,
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/lib/server/load-intelligence-signals', () => ({
  loadIntelligenceSignals: mocks.loadIntelligenceSignals,
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))

import { GET } from '@/app/api/intelligence/signals/route'

const supabase = { auth: { getUser: mocks.getUser } }
const model = {
  generatedAt: '2026-07-15T12:00:00.000Z',
  month: '2026-07',
  currency: 'ARS',
  dataQuality: 'ok',
  signals: [],
  coverage: [],
}

beforeEach(() => {
  mocks.flagEnabled = true
  mocks.createClient.mockResolvedValue(supabase)
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-private' } } })
  mocks.checkRateLimit.mockReturnValue(true)
  mocks.loadIntelligenceSignals.mockResolvedValue(model)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

async function responseBody(response: Response) {
  return response.json() as Promise<unknown>
}

describe('GET /api/intelligence/signals', () => {
  it('responde 404 sin autenticar ni cargar datos cuando la flag está apagada', async () => {
    mocks.flagEnabled = false

    const response = await GET()

    expect(response.status).toBe(404)
    await expect(responseBody(response)).resolves.toEqual({ error: 'Not found' })
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(mocks.loadIntelligenceSignals).not.toHaveBeenCalled()
  })

  it('responde 401 y no consume rate limit cuando no hay usuario', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })

    const response = await GET()

    expect(response.status).toBe(401)
    await expect(responseBody(response)).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.checkRateLimit).not.toHaveBeenCalled()
    expect(mocks.loadIntelligenceSignals).not.toHaveBeenCalled()
  })

  it('limita a 20 lecturas por minuto por usuario', async () => {
    mocks.checkRateLimit.mockReturnValue(false)

    const response = await GET()

    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      'intelligence-signals:user-private',
      20,
      60_000,
    )
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(mocks.loadIntelligenceSignals).not.toHaveBeenCalled()
  })

  it('carga el centro actual con la identidad autenticada sin efectuar escrituras', async () => {
    const response = await GET()

    expect(mocks.loadIntelligenceSignals).toHaveBeenCalledOnce()
    expect(mocks.loadIntelligenceSignals).toHaveBeenCalledWith({
      supabase,
      userId: 'user-private',
    })
    expect(response.status).toBe(200)
    await expect(responseBody(response)).resolves.toEqual(model)
  })

  it('neutraliza también los errores de autenticación sin exponer detalles', async () => {
    const authError = new Error('cookie secreta de user-private')
    mocks.getUser.mockRejectedValue(authError)

    const response = await GET()

    expect(mocks.captureRouteError).toHaveBeenCalledWith(authError, {
      route: 'GET /api/intelligence/signals',
      operation: 'intelligence_signals',
    })
    expect(response.status).toBe(500)
    await expect(responseBody(response)).resolves.toEqual({
      error: 'No pude cargar tus señales ahora.',
    })
  })

  it('reporta a Sentry con contexto neutro y devuelve un 500 sin datos sensibles', async () => {
    const sensitiveError = new Error('saldo ARS 123456 de user-private')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.loadIntelligenceSignals.mockRejectedValue(sensitiveError)

    const response = await GET()

    expect(mocks.captureRouteError).toHaveBeenCalledWith(sensitiveError, {
      route: 'GET /api/intelligence/signals',
      operation: 'intelligence_signals',
    })
    expect(consoleError).not.toHaveBeenCalled()
    expect(response.status).toBe(500)
    const serialized = JSON.stringify(await responseBody(response))
    expect(serialized).toBe('{"error":"No pude cargar tus señales ahora."}')
    expect(serialized).not.toContain('123456')
    expect(serialized).not.toContain('user-private')
  })
})
