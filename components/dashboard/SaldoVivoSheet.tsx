'use client'

import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Info } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'

interface AccountRow {
  id: string
  name: string
  type: string
  is_primary: boolean
  saldo: number
}

interface BreakdownData {
  breakdown: AccountRow[]
  total: number
  currency: 'ARS' | 'USD'
}

interface Props {
  open: boolean
  onClose: () => void
  selectedMonth: string // YYYY-MM
  currency: 'ARS' | 'USD'
  isProjected?: boolean
}

export function SaldoVivoSheet({ open, onClose, currency }: Props) {
  const { data, isLoading } = useQuery<BreakdownData>({
    queryKey: ['account-breakdown', currency],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/account-breakdown?currency=${currency}`)
      if (!res.ok) throw new Error('breakdown fetch failed')
      return res.json()
    },
    enabled: open,
    staleTime: 0,
  })

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
        SALDO VIVO
      </p>
      <p className="mt-1 mb-6 text-[36px] font-extrabold leading-none tabular-nums text-text-primary">
        {data ? formatAmount(data.total, currency) : '—'}
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex justify-between py-3">
              <div className="h-4 w-32 animate-pulse rounded bg-bg-tertiary" />
              <div className="h-4 w-24 animate-pulse rounded bg-bg-tertiary" />
            </div>
          ))}
        </div>
      ) : data && data.breakdown.length > 0 ? (
        <div>
          {data.breakdown.map((acc, idx) => {
            const isLast = idx === data.breakdown.length - 1
            const isNeg = acc.saldo < 0
            return (
              <div
                key={acc.id}
                className={`flex items-center justify-between py-3.5 ${!isLast ? 'border-b border-border-subtle' : ''}`}
              >
                <span className="text-sm text-text-secondary">{acc.name}</span>
                <span
                  className={`text-sm font-semibold tabular-nums ${isNeg ? 'text-danger' : 'text-text-primary'}`}
                >
                  {isNeg ? '−' : ''}
                  {formatAmount(Math.abs(acc.saldo), currency)}
                </span>
              </div>
            )
          })}

          <div className="mt-1 flex items-center justify-between border-t border-border-strong pt-3.5">
            <span className="text-sm font-semibold text-text-primary">Total</span>
            <span
              className={`text-sm font-bold tabular-nums ${data.total < 0 ? 'text-danger' : 'text-text-primary'}`}
            >
              {data.total < 0 ? '−' : ''}
              {formatAmount(Math.abs(data.total), currency)}
            </span>
          </div>

          <div className="mt-5 flex gap-3 rounded-[14px] bg-bg-secondary px-4 py-3.5">
            <Info size={16} weight="light" className="text-text-dim shrink-0 mt-0.5" />
            <p className="text-[12px] text-text-secondary leading-[1.55]">
              El Saldo Vivo es la suma real de todo tu dinero ahora mismo: cuentas bancarias, billeteras digitales y
              efectivo. Es el mismo número que ves en cada uno de tus bancos.
            </p>
          </div>
        </div>
      ) : (
        <p className="py-4 text-sm text-text-tertiary">Sin datos para mostrar.</p>
      )}
    </Modal>
  )
}
