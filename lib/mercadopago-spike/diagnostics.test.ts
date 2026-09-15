import { describe, expect, it } from 'vitest'
import { buildDiagnosticPayload, sanitizeError, sanitizeProbeDiagnostic } from './diagnostics'
import { MERCADOPAGO_OAUTH_COOKIE_NAMES } from './oauth'
import { runReadOnlyProbes } from './probes'

describe('Mercado Pago probe diagnostics', () => {
  it('define las dos cookies que se limpian al éxito y al fallo', () => {
    expect(MERCADOPAGO_OAUTH_COOKIE_NAMES).toEqual([
      'mp_personal_oauth_state',
      'mp_personal_oauth_verifier',
    ])
  })

  it('builds a response payload without secrets or provider values', () => {
    const payload = buildDiagnosticPayload([{
      name: 'user',
      method: 'GET',
      path: '/users/me',
      diagnostic: sanitizeProbeDiagnostic({ status: 200, payload: { id: 'provider-id' } }),
    }])
    expect(JSON.stringify(payload)).not.toContain('provider-id')
    expect(payload.probes[0]).toMatchObject({ name: 'user', method: 'GET', path: '/users/me', fields: ['id'] })
  })

  it('allowlists field names and never returns payload values', () => {
    const result = sanitizeProbeDiagnostic({
      status: 200,
      payload: {
        id: 'provider-id-secret',
        results: [{ description: 'salary', amount: 99999 }],
        access_token: 'secret',
        unexpected: 'do-not-return',
      },
    })

    expect(result).toEqual({
      status: 200,
      ok: true,
      payloadType: 'object',
      count: 1,
      fields: ['id', 'results'],
      error: null,
    })
    expect(JSON.stringify(result)).not.toContain('provider-id-secret')
    expect(JSON.stringify(result)).not.toContain('salary')
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('redacta secretos antes de exponer errores', () => {
    const safe = sanitizeError(new Error('Authorization: Bearer abc123 access_token=xyz client_secret=topsecret'))
    expect(safe).not.toContain('abc123')
    expect(safe).not.toContain('xyz')
    expect(safe).not.toContain('topsecret')
  })

  it.each([401, 403, 404, 429, 500, 503])('conserva status %s por probe sin hacer writes', async (status) => {
    const calls: Array<{ url: string; method: string }> = []
    const probes = await runReadOnlyProbes({
      accessToken: 'access-token-never-returned',
      now: new Date('2026-09-15T12:00:00Z'),
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), method: init?.method ?? 'GET' })
        return new Response(JSON.stringify({ id: 'secret-id', description: 'secret-description' }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    })

    expect(probes).toHaveLength(3)
    expect(probes.every((probe) => probe.diagnostic.status === status)).toBe(true)
    expect(probes.every((probe) => probe.diagnostic.ok === false)).toBe(true)
    expect(calls).toHaveLength(3)
    expect(calls.every((call) => call.method === 'GET')).toBe(true)
    expect(calls.map((call) => call.url)).toEqual(expect.arrayContaining([
      'https://api.mercadopago.com/users/me',
    ]))
    expect(JSON.stringify(probes)).not.toContain('secret-id')
    expect(JSON.stringify(probes)).not.toContain('secret-description')
  })
})
