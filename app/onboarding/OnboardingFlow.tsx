'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardStep1Welcome } from './steps/OnboardStep1Welcome'
import { OnboardStep2Moneda } from './steps/OnboardStep2Moneda'
import { OnboardStep3Cuenta } from './steps/OnboardStep3Cuenta'
import { OnboardStep4Saldo } from './steps/OnboardStep4Saldo'
import { OnboardStep5Done } from './steps/OnboardStep5Done'
import { trackEvent } from '@/lib/product-analytics/client'

type AccountType = 'bank' | 'cash' | 'digital'

type OnboardingData = {
  accountId: string | null
  accountName: string
  accountType: AccountType
  balanceARS: number | null
  balanceUSD: number | null
  preferredCurrency: 'ARS' | 'USD'
  heroBalanceMode: 'combined_ars' | 'combined_usd' | 'default_currency'
}

const initialData: OnboardingData = {
  accountId: null,
  accountName: '',
  accountType: 'bank',
  balanceARS: null,
  balanceUSD: null,
  preferredCurrency: 'ARS',
  heroBalanceMode: 'default_currency',
}

interface Props {
  initialCurrency: 'ARS' | 'USD'
  currentMonth: string
}

export function OnboardingFlow({ initialCurrency }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    ...initialData,
    preferredCurrency: initialCurrency,
  })

  useEffect(() => {
    trackEvent('onboarding_started', { initial_currency: initialCurrency })
  }, [initialCurrency])

  // Step 0 — Welcome
  if (step === 0) {
    return <OnboardStep1Welcome onNext={() => setStep(1)} />
  }

  // Step 1 — Moneda
  if (step === 1) {
    return (
      <OnboardStep2Moneda
        onBack={() => setStep(0)}
        onNext={(currency, heroMode) => {
          setData((d) => ({ ...d, preferredCurrency: currency, heroBalanceMode: heroMode }))
          setStep(2)
        }}
      />
    )
  }

  // Step 2 — Cuenta
  if (step === 2) {
    return (
      <OnboardStep3Cuenta
        onBack={() => setStep(1)}
        onNext={(accountId, accountName, accountType) => {
          setData((d) => ({ ...d, accountId, accountName, accountType }))
          setStep(3)
        }}
      />
    )
  }

  // Step 3 — Saldo inicial
  if (step === 3) {
    return (
      <OnboardStep4Saldo
        accountId={data.accountId!}
        accountName={data.accountName}
        preferredCurrency={data.preferredCurrency}
        heroBalanceMode={data.heroBalanceMode}
        onBack={() => setStep(2)}
        onNext={(balanceARS, balanceUSD) => {
          setData((d) => ({ ...d, balanceARS, balanceUSD }))
          setStep(4)
        }}
      />
    )
  }

  // Step 4 — Done
  return (
    <OnboardStep5Done
      accountName={data.accountName}
      balanceARS={data.balanceARS}
      balanceUSD={data.balanceUSD}
      onNext={() => router.push('/')}
    />
  )
}
