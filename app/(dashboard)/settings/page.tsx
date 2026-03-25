import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountSection } from '@/components/settings/AccountSection'
import { SettingsPreferences } from '@/components/settings/SettingsPreferences'
import { getCurrentMonth } from '@/lib/dates'
import type { Card, RolloverMode, Account } from '@/types/database'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: config }, { data: accountsData }] = await Promise.all([
    supabase
      .from('user_config')
      .select('cards, default_currency, rollover_mode')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
  ])

  const currency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const allCards: Card[] = (config?.cards as Card[]) ?? []
  const rolloverMode = (config?.rollover_mode ?? 'off') as RolloverMode
  const currentMonth = getCurrentMonth()
  const accounts: Account[] = (accountsData ?? []) as Account[]
  const cashAccount = accounts.find((a) => a.type === 'cash') ?? null
  const bankDigitalAccounts = accounts.filter((a) => a.type !== 'cash')

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-md px-5 pt-safe pb-tab-bar">
        <SettingsPreferences
          currentMonth={currentMonth}
          currency={currency}
          cards={allCards}
          rolloverMode={rolloverMode}
          bankDigitalAccounts={bankDigitalAccounts}
          cashAccount={cashAccount}
        />

        {/* Cuenta */}
        <section className="mt-10">
          <p className="mb-4 type-label text-text-label">Cuenta</p>
          <AccountSection email={user.email ?? ''} />
        </section>
      </div>
    </div>
  )
}
