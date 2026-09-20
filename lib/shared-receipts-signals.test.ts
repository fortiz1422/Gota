import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SignalsNowView } from '@/components/signals/SignalsNowView'

const receipt = {
  id: 'receipt-1',
  status: 'needs_review',
  created_at: '2026-09-06T11:00:00.000Z',
}

describe('shared receipts in Signals', () => {
  it('shows pending receipts as an actionable notification even without financial signals', () => {
    const html = renderToStaticMarkup(createElement(SignalsNowView, {
      signals: [],
      coverage: [],
      dataQuality: 'ok',
      amountsVisible: true,
      pendingReceipts: [receipt],
      onSelectSignal: () => undefined,
      onSelectReceipt: () => undefined,
    }))

    expect(html).toContain('1 comprobante pendiente')
    expect(html).toContain('Revisar propuesta')
    expect(html).not.toContain('Todo tranquilo')
  })

  it('keeps receipt review available when financial signals fail to load', () => {
    const html = renderToStaticMarkup(createElement(SignalsNowView, {
      signals: [],
      coverage: [],
      dataQuality: 'insufficient',
      amountsVisible: true,
      error: 'signals unavailable',
      pendingReceipts: [receipt],
      onSelectSignal: () => undefined,
      onSelectReceipt: () => undefined,
    }))

    expect(html).toContain('1 comprobante pendiente')
  })

  it('keeps Mercado Pago review visible while Signals loads or fails, without inventing a Signal', () => {
    const mercadoPago = {
      eligible: [{ candidateId: 'balance-debit' }],
      cardPending: [{ candidateId: 'card-purchase' }],
      unknown: [{ candidateId: 'unknown' }],
    } as never

    for (const props of [{ loading: true }, { error: 'signals unavailable' }]) {
      const html = renderToStaticMarkup(createElement(SignalsNowView, {
        signals: [],
        coverage: [],
        dataQuality: 'insufficient',
        amountsVisible: false,
        mercadoPago,
        onSelectSignal: () => undefined,
        onMercadoPagoSelected: () => undefined,
        ...props,
      }))

      expect(html).toContain('2 operaciones de Mercado Pago')
      expect(html).toContain('1 listas para revisar · 1 pagadas con tarjeta')
      expect(html).not.toContain('Todo tranquilo')
      expect(html).not.toContain('signals unavailable')
    }
  })

  it('does not surface unknown Mercado Pago rows as actionable work', () => {
    const html = renderToStaticMarkup(createElement(SignalsNowView, {
      signals: [],
      coverage: [],
      dataQuality: 'ok',
      amountsVisible: true,
      mercadoPago: { eligible: [], cardPending: [], unknown: [{ candidateId: 'unknown' }] } as never,
      onSelectSignal: () => undefined,
      onMercadoPagoSelected: () => undefined,
    }))

    expect(html).not.toContain('Mercado Pago')
  })

  it('removes the receipt CTA from Home and routes pending receipts through Signals', () => {
    const dashboard = readFileSync(
      new URL('../components/dashboard/DashboardShell.tsx', import.meta.url),
      'utf8',
    )

    expect(dashboard).not.toContain('<SharedReceiptsInboxCard />')
    expect(dashboard).toContain('pendingReceipts={pendingReceipts}')
    expect(dashboard).toContain("router.push(`/shared-receipts/${encodeURIComponent(receipt.id)}`)")
  })
})
