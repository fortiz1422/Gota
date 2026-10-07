'use client'

import { AccountSetup } from '@/components/onboarding/AccountSetup'
import { FirstExpenseGuide } from '@/components/onboarding/FirstExpenseGuide'

const account = {
  id: 'design-account',
  name: 'BBVA',
  type: 'bank' as const,
  opening_balance_ars: 128450,
  opening_balance_usd: 0,
}
export function OnboardingDesignExamples() {
  return (
    <div>
      <p
        style={{
          padding: 16,
          background: '#173047',
          color: 'white',
          fontSize: 12,
        }}
      >
        Diseño de onboarding · datos de ejemplo · vistas sin acciones de
        guardado
      </p>
      <section data-design-screen="setup" inert>
        <AccountSetup isAnonymous onSave={() => undefined} />
      </section>
      <section data-design-screen="configured" inert>
        <AccountSetup
          initialAccount={account}
          isAnonymous
          onSave={() => undefined}
        />
      </section>
      <section data-design-screen="error" inert>
        <AccountSetup
          initialAccount={account}
          isAnonymous
          error="Tu cuenta quedó guardada. Falta terminar la configuración: reintentá acá."
          onSave={() => undefined}
        />
      </section>
      <section
        data-design-screen="first-expense"
        inert
        style={{ maxWidth: 390, margin: 'auto', padding: 22 }}
      >
        <FirstExpenseGuide
          accounts={[]}
          cards={[]}
          onAfterSave={() => undefined}
        />
      </section>
    </div>
  )
}
