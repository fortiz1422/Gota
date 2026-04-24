import { NextResponse } from 'next/server'

export const revalidate = 300

type DolarApiResponse = {
  compra: number
  venta: number
  fechaActualizacion: string
}

type QuotePayload = {
  compra: number
  venta: number
  fechaActualizacion: string
  rate: number
  effectiveDate: string
  updatedAt: string
  source: 'dolarapi'
  kind: 'oficial'
  stale: boolean
}

let lastSuccessfulQuote: QuotePayload | null = null

function toEffectiveDate(raw: string) {
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  })
}

function toUpdatedAt(raw: string) {
  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return raw
  return parsed.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildQuotePayload(data: DolarApiResponse, stale: boolean): QuotePayload | null {
  const compra = Number(data.compra)
  const venta = Number(data.venta)

  if (!Number.isFinite(compra) || !Number.isFinite(venta) || venta <= 0) {
    return null
  }

  return {
    compra,
    venta,
    fechaActualizacion: data.fechaActualizacion,
    rate: venta,
    effectiveDate: toEffectiveDate(data.fechaActualizacion),
    updatedAt: toUpdatedAt(data.fechaActualizacion),
    source: 'dolarapi',
    kind: 'oficial',
    stale,
  }
}

export async function GET() {
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/oficial', {
      next: { revalidate: 300 },
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    })

    if (res.ok) {
      const raw = (await res.json()) as DolarApiResponse
      const payload = buildQuotePayload(raw, false)
      if (payload) {
        lastSuccessfulQuote = payload
        return NextResponse.json(payload)
      }
    }

    if (lastSuccessfulQuote) {
      return NextResponse.json({
        ...lastSuccessfulQuote,
        stale: true,
      })
    }

    return NextResponse.json(
      { error: 'No se pudo obtener la cotizacion' },
      { status: 502 },
    )
  } catch {
    if (lastSuccessfulQuote) {
      return NextResponse.json({
        ...lastSuccessfulQuote,
        stale: true,
      })
    }

    return NextResponse.json(
      { error: 'Error al consultar cotizacion' },
      { status: 502 },
    )
  }
}
