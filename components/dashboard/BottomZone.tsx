'use client'

import { SmartInput } from '@/components/dashboard/SmartInput'
import { TabBar } from '@/components/navigation/TabBar'
import type { Account, Card } from '@/types/database'

interface Props {
  accounts: Account[]
  cards: Card[]
  keyboardOffset?: number
  onAfterSave?: () => void
}

export function BottomZone({ accounts, cards, keyboardOffset = 0, onAfterSave }: Props) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[color:var(--color-separator)]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--color-nav-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : 'translateY(0)',
        transition: keyboardOffset > 0 ? 'none' : 'transform 0.25s ease',
      }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col px-4 pt-3">
        <SmartInput
          cards={cards}
          accounts={accounts}
          onAfterSave={onAfterSave}
          variant="bottom-zone"
        />
        <TabBar integrated />
      </div>
    </div>
  )
}
