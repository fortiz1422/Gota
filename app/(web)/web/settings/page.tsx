import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WebSettingsPage } from '@/components/web/settings/WebSettingsPage'
import type { Card, HeroBalanceMode } from '@/types/database'

export default async function WebSettingsRoute() {
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
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('created_at', { ascending: true }),
  ])

  return (
    <WebSettingsPage
      email={user.email ?? ''}
      isAnonymous={user.is_anonymous === true}
      authProviders={authProviders}
      currency={(config?.default_currency ?? 'ARS') as 'ARS' | 'USD'}
      heroBalanceMode={(config?.hero_balance_mode ?? 'combined_ars') as HeroBalanceMode}
      accounts={accountsData ?? []}
      cards={(cardsData ?? []) as Card[]}
    />
  )
}
