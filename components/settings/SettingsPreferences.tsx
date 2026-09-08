'use client'

import { useState } from 'react'
import { Bank, CreditCard, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { CurrencySection } from '@/components/settings/CurrencySection'
import { AccountsSection } from '@/components/settings/AccountsSection'
import { CardsSection } from '@/components/settings/CardsSection'
import { HeroBalanceModePreference } from '@/components/settings/HeroBalanceModePreference'
import { SubscriptionsPreference } from '@/components/settings/SubscriptionsPreference'
import { SharedReceiptDevicesPanel } from '@/components/settings/SharedReceiptDevicesPanel'
import { CounterpartyAliasesPanel } from '@/components/settings/CounterpartyAliasesPanel'
import { BlueHeaderZone } from '@/components/ui/BlueHeaderZone'
import styles from './MobileSettings.module.css'
import { SettingsDetail } from './SettingsDetail'
import { addMonths } from '@/lib/dates'
import { getProfilePreferenceVisibility } from '@/lib/settings/profile-preference-visibility'
import type { Account, Card, HeroBalanceMode } from '@/types/database'

function getMonthLabel(month: string): string {
  const label = new Date(month + '-15').toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

interface Props {
  currentMonth: string
  currency: 'ARS' | 'USD'
  cards: Card[]
  accounts: Account[]
  heroBalanceMode: HeroBalanceMode
  signalsCenterEnabled: boolean
}

export function SettingsPreferences({
  currentMonth,
  currency,
  cards,
  accounts,
  heroBalanceMode,
  signalsCenterEnabled,
}: Props) {
  const bankDigitalAccounts = accounts.filter((a) => a.type !== 'cash')
  const [month, setMonth] = useState(currentMonth)
  const minMonth = addMonths(currentMonth, -12)
  const maxMonth = addMonths(currentMonth, 3)
  const preferenceVisibility = getProfilePreferenceVisibility(signalsCenterEnabled)

  return (
    <div className={styles.preferences}>
      <BlueHeaderZone className={styles.header}>
        <p className={styles.eyebrow}>TU GOTA</p>
        <h1>{signalsCenterEnabled ? 'Perfil' : 'Configuración'}</h1>
        <p className={styles.intro}>Tu forma de ver, cargar y cuidar tu dinero.</p>
      </BlueHeaderZone>

      <section className={styles.group} aria-labelledby="settings-reading-title">
        <h2 id="settings-reading-title">Lectura</h2>
        <p className={styles.description}>Elegí la moneda y cómo ver tu saldo.</p>
        <div className={styles.reading}>
          <CurrencySection currency={currency} />
          {preferenceVisibility.heroBalanceMode && (
            <HeroBalanceModePreference initialValue={heroBalanceMode} />
          )}
        </div>
      </section>

      <section className={styles.group} aria-labelledby="settings-finances-title">
        <h2 id="settings-finances-title">Cuentas y tarjetas</h2>
        <p className={styles.description}>Administrá tus medios de pago y sus datos.</p>
        <div className={styles.rowGroup}>
          <SettingsDetail title="Cuentas" description="Administrá tus cuentas y saldos por período" icon={<Bank size={20} weight="light" />}>
        <div className={styles.period}>
          <div>
            <p className={styles.periodLabel}>Período de consulta</p>
            <p className={styles.periodHint}>Saldos y fechas de cuentas y tarjetas</p>
          </div>
          <div className={styles.monthControl}>
            <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))}
              disabled={month <= minMonth} aria-label="Mes anterior">
              <CaretLeft weight="light" size={18} />
            </button>
            <span aria-live="polite" aria-atomic="true">{getMonthLabel(month)}</span>
            <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))}
              disabled={month >= maxMonth} aria-label="Mes siguiente">
              <CaretRight weight="light" size={18} />
            </button>
          </div>
        </div>
            <AccountsSection initialAccounts={accounts} month={month} standalone />
          </SettingsDetail>
          <SettingsDetail title="Tarjetas" description="Administrá tus tarjetas y fechas de cierre" icon={<CreditCard size={20} weight="light" />}>
        <div className={styles.period}>
          <div>
            <p className={styles.periodLabel}>Período de consulta</p>
            <p className={styles.periodHint}>Saldos y fechas de cuentas y tarjetas</p>
          </div>
          <div className={styles.monthControl}>
            <button type="button" onClick={() => setMonth((m) => addMonths(m, -1))}
              disabled={month <= minMonth} aria-label="Mes anterior">
              <CaretLeft weight="light" size={18} />
            </button>
            <span aria-live="polite" aria-atomic="true">{getMonthLabel(month)}</span>
            <button type="button" onClick={() => setMonth((m) => addMonths(m, 1))}
              disabled={month >= maxMonth} aria-label="Mes siguiente">
              <CaretRight weight="light" size={18} />
            </button>
          </div>
        </div>
            <CardsSection cards={cards} month={month} accounts={bankDigitalAccounts} standalone />
          </SettingsDetail>
        </div>
        {preferenceVisibility.subscriptions && (
          <div className={styles.subscription}><SubscriptionsPreference defaultCurrency={currency} /></div>
        )}
      </section>

      <section className={styles.group} aria-labelledby="settings-personalization-title">
        <h2 id="settings-personalization-title">Personalización</h2>
        <p className={styles.description}>Menos correcciones al cargar.</p>
        <div className={styles.entry}><CounterpartyAliasesPanel /></div>
      </section>

      <section className={styles.group} aria-labelledby="settings-integrations-title">
        <h2 id="settings-integrations-title">Integraciones</h2>
        <p className={styles.description}>Conectá la carga con tu día a día.</p>
        <div className={styles.entry}><SharedReceiptDevicesPanel /></div>
      </section>
    </div>
  )
}
