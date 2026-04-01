'use client'

import { ProgressDots } from '../components/ProgressDots'
import { BackButton } from '../components/BackButton'
import { SmartInput } from '@/components/dashboard/SmartInput'
import type { Account } from '@/types/database'

const EXAMPLES = ['café 1500', 'almuerzo 4 lucas', 'uber 3k', 'despensa 15000']

interface Props {
  accountId: string
  accountName: string
  accountType: 'bank' | 'cash' | 'digital'
  onBack: () => void
  onNext: () => void
}

export function Step5SmartInput({ accountId, accountName, accountType, onBack, onNext }: Props) {
  const primaryAccount: Account = {
    id: accountId,
    name: accountName,
    type: accountType,
    is_primary: true,
    archived: false,
    opening_balance_ars: 0,
    opening_balance_usd: 0,
    daily_yield_enabled: false,
    daily_yield_rate: null,
    user_id: '',
    created_at: '',
    updated_at: '',
  }
  return (
    <div className="flex min-h-screen flex-col bg-bg-primary px-5 pb-10 pt-safe">
      <div className="flex items-center gap-3 py-4">
        <BackButton onClick={onBack} />
        <div className="flex-1">
          <ProgressDots total={4} current={3} />
        </div>
        <div className="w-6" />
      </div>

      <div className="mt-6 mb-6">
        <h2 className="text-2xl font-semibold text-text-primary">
          Registrá tu último gasto
        </h2>
        <p className="mt-2 text-sm text-text-tertiary">Escribilo como quieras.</p>
      </div>

      {/* Example chips */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {EXAMPLES.map((ex) => (
          <span
            key={ex}
            className="shrink-0 rounded-full border border-primary/15 bg-primary/8 px-3 py-1.5 text-xs text-primary"
          >
            {ex}
          </span>
        ))}
      </div>

      <div className="flex-1">
        <SmartInput cards={[]} accounts={[primaryAccount]} onAfterSave={onNext} />
      </div>

      <button
        onClick={onNext}
        className="mt-6 w-full py-2 text-sm text-text-tertiary transition-colors active:text-text-secondary"
      >
        Hacerlo después
      </button>
    </div>
  )
}
