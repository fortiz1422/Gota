'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AccountSetup } from '@/components/onboarding/AccountSetup'
import {
  saveAccountSetup,
  type AccountSetupInput,
  type SetupAccount,
  type SetupCurrency,
} from '@/lib/onboarding-setup'
import { trackEvent } from '@/lib/product-analytics/client'

interface Props {
  initialCurrency: SetupCurrency
  initialAccount?: SetupAccount | null
  isAnonymous?: boolean
  destination?: string
}

export function OnboardingFlow({
  initialCurrency,
  initialAccount,
  isAnonymous,
  destination = '/',
}: Props) {
  const router = useRouter()
  const [account, setAccount] = useState(initialAccount)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    trackEvent('onboarding_started', { initial_currency: initialCurrency })
  }, [initialCurrency])

  async function save(input: AccountSetupInput) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    try {
      await saveAccountSetup(input, {
        onAccountSaved: (saved) => {
          setAccount(saved)
        },
      })
      trackEvent('onboarding_completed', { has_initial_balance: true })
      router.replace(destination)
      router.refresh()
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'No pudimos guardar. Intentá de nuevo.'
      )
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <AccountSetup
      initialCurrency={initialCurrency}
      initialAccount={account}
      isAnonymous={isAnonymous}
      saving={saving}
      error={error}
      onSave={(input) => void save(input)}
    />
  )
}
