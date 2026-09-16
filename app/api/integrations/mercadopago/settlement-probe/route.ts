import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getMercadoPagoOAuthReadiness } from '@/lib/mercadopago/oauth'
import { decryptMercadoPagoToken } from '@/lib/mercadopago/token-crypto'
import { getMercadoPagoConnections } from '@/lib/mercadopago/server-repository'
import { runSettlementProbe, type SettlementProbeResult } from '@/lib/mercadopago/settlement-probe'

const DIAGNOSTIC_KEY_HASH = '4695a62004c037d9a741dfdaa23a558b487ab19af3a2fef513beb98f13888423'
const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
const hidden = () => NextResponse.json({ error: 'not_found' }, { status: 404, headers })

function validDiagnosticKey(value: string | null): boolean {
  if (!value) return false
  const actual = createHash('sha256').update(value, 'utf8').digest()
  const expected = Buffer.from(DIAGNOSTIC_KEY_HASH, 'hex')
  return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected)
}

function responseBody(result: SettlementProbeResult): SettlementProbeResult {
  return {
    stage: result.stage,
    httpStatus: result.httpStatus,
    accepted: result.accepted,
    classification: result.classification,
    ...(typeof result.hasFile === 'boolean' ? { hasFile: result.hasFile } : {}),
  }
}

export async function POST(request: Request) {
  if (!validDiagnosticKey(request.headers.get('x-gota-diagnostic-key'))) return hidden()
  try {
    const readiness = getMercadoPagoOAuthReadiness()
    if (!readiness.ok) return hidden()
    const connections = await getMercadoPagoConnections()
    const result = responseBody(await runSettlementProbe({
      connections,
      decrypt: (ciphertext) => decryptMercadoPagoToken({ ciphertext, encryptionKey: readiness.config.tokenEncryptionKey }),
    }))
    return NextResponse.json(result, { status: result.httpStatus === 202 ? 202 : result.httpStatus && result.httpStatus >= 400 ? result.httpStatus : 200, headers })
  } catch {
    return hidden()
  }
}
