'use client'

import { useEffect, useRef, useState } from 'react'
import { SmartInput } from '@/components/dashboard/SmartInput'
import { TabBar } from '@/components/navigation/TabBar'
import type { Account, Card } from '@/types/database'

interface Props {
  accounts: Account[]
  cards: Card[]
  keyboardOffset?: number
  onAfterSave?: () => void
  focusSignal?: number
}

export function BottomZone({
  accounts,
  cards,
  keyboardOffset = 0,
  onAfterSave,
  focusSignal = 0,
}: Props) {
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const scrollYRef = useRef(0)

  useEffect(() => {
    if (!isComposerOpen) return

    scrollYRef.current = window.scrollY

    const { body, documentElement } = document
    const previousBodyOverflow = body.style.overflow
    const previousBodyPosition = body.style.position
    const previousBodyTop = body.style.top
    const previousBodyWidth = body.style.width
    const previousHtmlOverflow = documentElement.style.overflow

    documentElement.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollYRef.current}px`
    body.style.width = '100%'

    return () => {
      documentElement.style.overflow = previousHtmlOverflow
      body.style.overflow = previousBodyOverflow
      body.style.position = previousBodyPosition
      body.style.top = previousBodyTop
      body.style.width = previousBodyWidth
      window.scrollTo(0, scrollYRef.current)
    }
  }, [isComposerOpen])

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 ${
        isComposerOpen ? 'border-transparent' : 'border-t border-[color:var(--color-separator)]'
      }`}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: isComposerOpen ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.92)',
        backdropFilter: isComposerOpen ? 'blur(8px)' : 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: isComposerOpen ? 'blur(8px)' : 'blur(20px) saturate(180%)',
        boxShadow: isComposerOpen
          ? '0 -1px 0 rgba(255,255,255,0.6) inset, 0 -8px 24px rgba(13,24,41,0.06)'
          : '0 -1px 0 rgba(255,255,255,0.6) inset, 0 -8px 24px rgba(13,24,41,0.04)',
        transform: keyboardOffset > 0 ? `translateY(-${keyboardOffset}px)` : 'translateY(0)',
        transition: keyboardOffset > 0 ? 'none' : 'transform 0.25s ease',
      }}
    >
      <div data-tour="smart-input" className={`mx-auto flex w-full max-w-md flex-col px-4 ${isComposerOpen ? 'pb-1 pt-2' : 'pt-3'}`}>
        <SmartInput
          cards={cards}
          accounts={accounts}
          onAfterSave={onAfterSave}
          onFocusChange={setIsComposerOpen}
          variant="bottom-zone"
          focusSignal={focusSignal}
        />
        {!isComposerOpen && <TabBar integrated />}
      </div>
    </div>
  )
}
