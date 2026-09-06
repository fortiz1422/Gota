'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CaretRight, Receipt } from '@phosphor-icons/react'
import { SHARED_RECEIPT_ROUTES, normalizeReceiptsResponse, type SharedReceiptSummary } from '@/lib/shared-receipts-ui'

export function SharedReceiptsInboxCard({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const [receipts, setReceipts] = useState<SharedReceiptSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const response = await fetch(SHARED_RECEIPT_ROUTES.inbox, { cache: 'no-store' })
      if (!response.ok) throw new Error()
      setReceipts(normalizeReceiptsResponse(await response.json()))
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (!alwaysShow && !loading && (failed || receipts.length === 0)) return null
  const first = receipts[0]

  return (
    <section className="rounded-card border border-primary/20 bg-primary/8 p-4" aria-busy={loading}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 text-primary"><Receipt size={20} weight="duotone" /></span>
        <div className="min-w-0 flex-1">
          <p className="type-label text-primary">Comprobantes</p>
          <h2 className="mt-1 text-base font-bold text-text-primary">
            {loading ? 'Buscando comprobantes…' : failed ? 'No pudimos cargar la bandeja' : receipts.length === 0 ? 'Bandeja al día' : `${receipts.length} ${receipts.length === 1 ? 'comprobante pendiente' : 'comprobantes pendientes'}`}
          </h2>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            {failed ? 'Reintentá sin perder ningún dato.' : receipts.length === 0 ? 'Los envíos desde tu iPhone aparecerán acá.' : 'Revisá la propuesta antes de confirmar. Nada cambia tus finanzas automáticamente.'}
          </p>
        </div>
      </div>
      {!loading && failed && <button type="button" onClick={() => void load()} className="mt-3 text-sm font-semibold text-primary">Reintentar</button>}
      {!loading && first && <Link href={`/shared-receipts/${encodeURIComponent(first.id)}`} className="mt-3 flex min-h-11 items-center justify-between rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-white">Revisar siguiente <CaretRight size={15} /></Link>}
    </section>
  )
}
