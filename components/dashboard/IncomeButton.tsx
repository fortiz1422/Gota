'use client'

import { useState } from 'react'
import { IncomeModal } from './IncomeModal'
import type { Account } from '@/types/database'

interface Props {
  accounts: Account[]
  currency: 'ARS' | 'USD'
}

export function IncomeButton({ accounts, currency }: Props) {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="mb-2 w-full rounded-full border border-dashed border-border-subtle py-1.5 text-xs text-text-tertiary transition-colors hover:border-success/40 hover:text-success"
      >
        + Ingreso
      </button>

      {showModal && (
        <IncomeModal
          accounts={accounts}
          defaultCurrency={currency}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
