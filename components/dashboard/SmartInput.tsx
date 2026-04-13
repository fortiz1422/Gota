'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from '@phosphor-icons/react'
import { ParsePreview } from './ParsePreview'
import type { Account, Card } from '@/types/database'

interface ParsedData {
  amount: number
  currency: 'ARS' | 'USD'
  category: string
  description: string
  is_want: boolean | null
  payment_method: 'CASH' | 'DEBIT' | 'TRANSFER' | 'CREDIT'
  card_id: string | null
  installments?: number | null
  date: string
}

interface SmartInputProps {
  cards: Card[]
  accounts: Account[]
  onAfterSave?: () => void
  variant?: 'default' | 'bottom-zone'
}

export function SmartInput({
  cards,
  accounts,
  onAfterSave,
  variant = 'default',
}: SmartInputProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parsed, setParsed] = useState<ParsedData | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    const trimmed = input.trim()
    if (!trimmed || isParsing) return

    setIsParsing(true)
    try {
      const res = await fetch('/api/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed }),
      })

      const data = await res.json()

      if (data.is_valid) {
        setParsed(data)
      } else {
        alert(data.reason ?? 'El input no parece ser un gasto')
      }
    } catch {
      alert('Error al procesar. Revisá tu conexión.')
    } finally {
      setIsParsing(false)
    }
  }

  const handleSave = () => {
    setParsed(null)
    setInput('')
    inputRef.current?.focus()
    if (onAfterSave) {
      onAfterSave()
    } else {
      router.refresh()
    }
  }

  const handleCancel = () => {
    setParsed(null)
    inputRef.current?.focus()
  }

  const hasInput = Boolean(input.trim())
  const isBottomZone = variant === 'bottom-zone'

  return (
    <>
      <div
        className={`surface-glass flex items-center gap-2.5 transition-colors duration-200 ${
          isBottomZone ? 'rounded-[14px] px-3 py-[9px]' : 'rounded-card px-4 py-3'
        } ${
          hasInput ? 'border-primary/35' : ''
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          placeholder="café 2500"
          disabled={isParsing}
          className={`flex-1 bg-transparent border-none outline-none type-body text-text-primary caret-primary placeholder:text-text-dim transition-opacity duration-200 ${
            isParsing ? 'opacity-50' : 'opacity-100'
          }`}
        />
        <button
          onClick={handleSubmit}
          disabled={!hasInput || isParsing}
          aria-label="Agregar gasto"
          className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-all duration-200 ${
            isBottomZone ? 'h-8 w-8' : 'h-9 w-9'
          } ${
            hasInput ? 'bg-primary' : 'bg-[color:var(--color-border-subtle)]'
          }`}
        >
          {isParsing ? (
            <span className="spinner" style={{ width: 16, height: 16 }} />
          ) : (
            <ArrowRight
              size={15}
              weight="bold"
              className={`transition-colors duration-200 ${hasInput ? 'text-white' : 'text-text-label'}`}
            />
          )}
        </button>
      </div>

      {parsed && (
        <ParsePreview
          data={parsed}
          cards={cards}
          accounts={accounts}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </>
  )
}
