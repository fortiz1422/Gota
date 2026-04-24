'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from '@phosphor-icons/react'
import { ParsePreview } from './ParsePreview'
import { InlineError } from '@/components/ui/InlineError'
import { trackEvent } from '@/lib/product-analytics/client'
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
  onFocusChange?: (focused: boolean) => void
  variant?: 'default' | 'bottom-zone'
  focusSignal?: number
}

function inputLengthBucket(length: number): 'short' | 'medium' | 'long' {
  if (length <= 24) return 'short'
  if (length <= 80) return 'medium'
  return 'long'
}

export function SmartInput({
  cards,
  accounts,
  onAfterSave,
  onFocusChange,
  variant = 'default',
  focusSignal = 0,
}: SmartInputProps) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedData | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const blurTimeoutRef = useRef<number | null>(null)
  const statusTimeoutRef = useRef<number | null>(null)

  const clearPendingBlur = () => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
  }

  useEffect(() => {
    if (focusSignal <= 0) return
    clearPendingBlur()
    inputRef.current?.focus()
    onFocusChange?.(true)
  }, [focusSignal, onFocusChange])

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current !== null) {
        window.clearTimeout(statusTimeoutRef.current)
      }
    }
  }, [])

  const handleSubmit = async () => {
    const trimmed = input.trim()
    if (!trimmed || isParsing) return

    setIsParsing(true)
    setParseError(null)
    trackEvent('smartinput_parse_started', {
      input_length: inputLengthBucket(trimmed.length),
      variant,
    })

    try {
      const res = await fetch('/api/parse-expense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed }),
      })

      const data = await res.json()

      if (data.is_valid) {
        trackEvent('smartinput_parse_succeeded', {
          currency: data.currency,
          has_card: Boolean(data.card_id),
          has_installments: Boolean(data.installments && data.installments > 1),
          payment_method: data.payment_method,
          variant,
        })
        setParsed(data)
      } else {
        trackEvent('smartinput_parse_failed', {
          failure_type: 'invalid_input',
          variant,
        })
        setParseError(
          data.reason ?? 'No pudimos entenderlo. Proba con algo como "cafe 2500".',
        )
      }
    } catch {
      trackEvent('smartinput_parse_failed', {
        failure_type: 'network_or_server',
        variant,
      })
      setParseError('No pudimos entenderlo. Proba con algo como "cafe 2500".')
    } finally {
      setIsParsing(false)
      setStatusMessage(null)
    }
  }

  const handleSave = () => {
    setParsed(null)
    setInput('')
    setParseError(null)
    setStatusMessage('Guardado')
    if (statusTimeoutRef.current !== null) {
      window.clearTimeout(statusTimeoutRef.current)
    }
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage(null)
      statusTimeoutRef.current = null
    }, 1200)
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
        } ${hasInput ? 'border-primary/35' : ''}`}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setParseError(null)
          }}
          onFocus={() => {
            clearPendingBlur()
            onFocusChange?.(true)
          }}
          onBlur={() => {
            clearPendingBlur()
            blurTimeoutRef.current = window.setTimeout(() => {
              onFocusChange?.(false)
              blurTimeoutRef.current = null
            }, 120)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
          }}
          placeholder="cafe 2500"
          disabled={isParsing}
          className={`type-body flex-1 border-none bg-transparent text-text-primary caret-primary outline-none placeholder:text-text-dim transition-opacity duration-200 ${
            isParsing ? 'opacity-50' : 'opacity-100'
          }`}
        />
        <button
          onPointerDown={clearPendingBlur}
          onClick={handleSubmit}
          disabled={!hasInput || isParsing}
          aria-label="Agregar gasto"
          className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full transition-all duration-200 ${
            isBottomZone ? 'h-8 w-8' : 'h-9 w-9'
          } ${hasInput ? 'bg-primary' : 'bg-[color:var(--color-border-subtle)]'}`}
        >
          {isParsing ? (
            <span className="spinner" style={{ width: 16, height: 16 }} />
          ) : (
            <ArrowRight
              size={15}
              weight="bold"
              className={`transition-colors duration-200 ${
                hasInput ? 'text-white' : 'text-text-label'
              }`}
            />
          )}
        </button>
      </div>
      {statusMessage && !parseError && (
        <div
          className="mt-2 rounded-card bg-primary/8 px-3 py-2 text-xs font-medium text-primary"
        >
          {statusMessage}
        </div>
      )}
      <InlineError message={parseError} className={isBottomZone ? 'mt-2' : 'mt-3'} />

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
