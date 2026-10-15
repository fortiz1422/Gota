'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AccountStep } from '@/components/onboarding/AccountStep'
import { CardsStep } from '@/components/onboarding/CardsStep'
import type { CardSetupSubmit } from '@/components/cards/CardSetupForm'
import {
  completeOnboarding,
  saveAccountSetup,
  type AccountSetupInput,
  type SetupAccount,
  type SetupCurrency,
} from '@/lib/onboarding-setup'
import { trackEvent } from '@/lib/product-analytics/client'
import styles from '@/components/onboarding/landing-flow.module.css'
import type { Card } from '@/types/database'

interface Props {
  initialCurrency: SetupCurrency
  initialAccount?: SetupAccount | null
  initialCards?: Card[]
  isAnonymous?: boolean
  destination?: string
}

export function OnboardingFlow({
  initialCurrency,
  initialAccount,
  initialCards = [],
  isAnonymous,
  destination = '/',
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(initialAccount ? 2 : 1)
  const [account, setAccount] = useState(initialAccount ?? null)
  const [currency, setCurrency] = useState<SetupCurrency>(initialCurrency)
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    const current = initialAccount ? 2 : 1
    trackEvent('onboarding_started', { initial_currency: initialCurrency, step: current })
    trackEvent('onboarding_step_viewed', { step: current })
  }, [initialAccount, initialCurrency])

  async function saveAccount(input: AccountSetupInput) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      await saveAccountSetup(input, {
        complete: false,
        onAccountSaved: (saved) => setAccount(saved),
      })
      setCurrency(input.currency)
      setStep(2)
      trackEvent('onboarding_step_viewed', { step: 2 })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos guardar. Intentá de nuevo.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  async function saveCard(input: CardSetupSubmit) {
    const response = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        closing_day: input.closing_day,
        due_day: input.due_day,
        account_id: input.account_id,
        last_four: input.last_four,
        statement_answer: input.statement_answer,
      }),
    })
    if (!response.ok) throw new Error('No pudimos guardar la tarjeta.')
    const saved = await response.json() as Card
    setCards((current) => current.some((card) => card.id === saved.id) ? current : [...current, saved])
    trackEvent('onboarding_card_saved', {
      dates_known: input.closing_day != null && input.due_day != null,
      statement: input.statement_answer,
    })
    if (input.closing_day == null || input.due_day == null) {
      trackEvent('onboarding_card_dates_deferred', { dates_known: false })
    }
  }

  async function finish(skipped: boolean) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      if (skipped) trackEvent('onboarding_cards_skipped', { step: 2 })
      await completeOnboarding()
      trackEvent('onboarding_completed', { has_initial_balance: true, skipped_cards: skipped })
      router.replace(destination)
      router.refresh()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos abrir Gota. Intentá de nuevo.')
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <main className={styles.shell}>
      {step === 1 || !account ? (
        <AccountStep
          initialAccount={account}
          initialCurrency={currency}
          isAnonymous={isAnonymous}
          saving={saving}
          error={error}
          onContinue={(input) => void saveAccount(input)}
        />
      ) : (
        <CardsStep
          account={account}
          currency={currency}
          cards={cards}
          saving={saving}
          onBack={() => setStep(1)}
          onSaveCard={saveCard}
          onOpen={() => void finish(false)}
          onSkip={() => void finish(true)}
        />
      )}
      {step === 2 && error ? <p role="alert" className="mx-auto max-w-[430px] px-6 pb-6 text-sm text-[#9b2c2c]">{error}</p> : null}
    </main>
  )
}
