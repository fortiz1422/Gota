import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountSection } from '@/components/settings/AccountSection'
import styles from '@/components/settings/MobileSettings.module.css'
import { SettingsPreferences } from '@/components/settings/SettingsPreferences'
import { getCurrentMonth } from '@/lib/dates'
import { FF_SIGNALS_CENTER_V1 } from '@/lib/flags'
import type { Card, HeroBalanceMode } from '@/types/database'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const rawProviders = (user.app_metadata as { providers?: unknown } | undefined)?.providers
  const authProviders = Array.isArray(rawProviders)
    ? rawProviders.filter((provider): provider is string => typeof provider === 'string')
    : []

  const [{ data: config }, { data: accountsData }, { data: cardsData }] = await Promise.all([
    supabase
      .from('user_config')
      .select('default_currency, hero_balance_mode')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
    supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
  ])

  const currency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const heroBalanceMode = (config?.hero_balance_mode ?? 'combined_ars') as HeroBalanceMode
  const allCards: Card[] = (cardsData ?? []) as Card[]
  const currentMonth = getCurrentMonth()
  const accounts = accountsData ?? []

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <SettingsPreferences
          currentMonth={currentMonth}
          currency={currency}
          cards={allCards}
          accounts={accounts}
          heroBalanceMode={heroBalanceMode}
          signalsCenterEnabled={FF_SIGNALS_CENTER_V1}
        />

        {/* Cuenta */}
        <div className={styles.account}>
          <AccountSection
            email={user.email ?? ''}
            isAnonymous={user.is_anonymous === true}
            authProviders={authProviders}
          />
        </div>
      </div>
    </div>
  )
}
