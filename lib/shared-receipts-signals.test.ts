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
