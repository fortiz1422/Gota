'use client'

import { useState } from 'react'
import { StepW1Welcome } from './steps/StepW1Welcome'
import { StepW2Goal } from './steps/StepW2Goal'
import { StepW3Pain } from './steps/StepW3Pain'
import { StepW4Proof } from './steps/StepW4Proof'
import { StepW5Solution } from './steps/StepW5Solution'
import { StepW6Currency } from './steps/StepW6Currency'
import { StepW7Processing } from './steps/StepW7Processing'
import { StepW8Paywall } from './steps/StepW8Paywall'
import { Step1SaldoVivo } from './steps/Step1SaldoVivo'
import { Step2Cuenta } from './steps/Step2Cuenta'
import { Step4SaldoInicial } from './steps/Step4SaldoInicial'
import { Step5SmartInput } from './steps/Step5SmartInput'
import { Step6Done } from './steps/Step6Done'

export type OnboardingData = {
  accountId: string | null
  accountName: string
  accountType: 'bank' | 'cash' | 'digital'
  balanceARS: number | null
  balanceUSD: number | null
  selectedGoal: string | null
  preferredCurrency: 'ARS' | 'USD'
}

const initialData: OnboardingData = {
  accountId: null,
  accountName: '',
  accountType: 'bank',
  balanceARS: null,
  balanceUSD: null,
  selectedGoal: null,
  preferredCurrency: 'ARS',
}

interface Props {
  initialCurrency: 'ARS' | 'USD'
  currentMonth: string
}

// Steps 0-6: wizard (conversion)
// Steps 7-11: setup (configuration)
// Step 12: paywall

export function OnboardingFlow({ initialCurrency, currentMonth: _currentMonth }: Props) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    ...initialData,
    preferredCurrency: initialCurrency,
  })

  // Wizard: Welcome
  if (step === 0) {
    return <StepW1Welcome onNext={() => setStep(1)} />
  }

  // Wizard: Goal
  if (step === 1) {
    return (
      <StepW2Goal
        onBack={() => setStep(0)}
        onNext={(goal) => {
          setData((d) => ({ ...d, selectedGoal: goal }))
          setStep(2)
        }}
      />
    )
  }

  // Wizard: Pain points
  if (step === 2) {
    return (
      <StepW3Pain
        onBack={() => setStep(1)}
        onNext={() => setStep(3)}
      />
    )
  }

  // Wizard: Social proof
  if (step === 3) {
    return <StepW4Proof onBack={() => setStep(2)} onNext={() => setStep(4)} />
  }

  // Wizard: Personalised solution
  if (step === 4) {
    return <StepW5Solution onBack={() => setStep(3)} onNext={() => setStep(5)} />
  }

  // Wizard: Currency preference
  if (step === 5) {
    return (
      <StepW6Currency
        onBack={() => setStep(4)}
        onNext={(currency) => {
          setData((d) => ({ ...d, preferredCurrency: currency }))
          setStep(6)
        }}
      />
    )
  }

  // Wizard: Processing moment (saves currency, auto-advances)
  if (step === 6) {
    return (
      <StepW7Processing
        preferredCurrency={data.preferredCurrency}
        onNext={() => setStep(7)}
      />
    )
  }

  // Setup: Saldo Vivo explanation
  if (step === 7) {
    return <Step1SaldoVivo onNext={() => setStep(8)} />
  }

  // Setup: Create account
  if (step === 8) {
    return (
      <Step2Cuenta
        onBack={() => setStep(7)}
        onNext={(accountId, accountName, accountType) => {
          setData((d) => ({ ...d, accountId, accountName, accountType }))
          setStep(9)
        }}
      />
    )
  }

  // Setup: Opening balance
  if (step === 9) {
    return (
      <Step4SaldoInicial
        accountId={data.accountId!}
        accountName={data.accountName}
        onBack={() => setStep(8)}
        onNext={(balanceARS, balanceUSD) => {
          setData((d) => ({ ...d, balanceARS, balanceUSD }))
          setStep(10)
        }}
      />
    )
  }

  // Setup: SmartInput demo
  if (step === 10) {
    return (
      <Step5SmartInput
        accountId={data.accountId!}
        accountName={data.accountName}
        accountType={data.accountType}
        onBack={() => setStep(9)}
        onNext={() => setStep(11)}
      />
    )
  }

  // Setup: Done → goes to paywall
  if (step === 11) {
    return <Step6Done data={data} onNext={() => setStep(12)} />
  }

  // Paywall
  return <StepW8Paywall />
}
