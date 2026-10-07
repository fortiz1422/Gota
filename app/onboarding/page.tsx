import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingFlow } from './OnboardingFlow'
import { safeDestination } from '@/lib/auth-destination'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const destination = safeDestination((await searchParams).next)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: config } = await supabase
    .from('user_config')
    .select('onboarding_completed, default_currency, hero_balance_mode')
    .eq('user_id', user.id)
    .single()

  if (config?.onboarding_completed) redirect(destination)

  const currency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'

  const { data: accounts } = await supabase
    .from('accounts')
    .select('id,name,type,opening_balance_ars,opening_balance_usd,is_primary')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: true })
  const account =
    accounts?.find((candidate) => candidate.is_primary) ?? accounts?.[0] ?? null
  return (
    <OnboardingFlow
      initialCurrency={currency}
      initialAccount={account}
      isAnonymous={user.is_anonymous === true}
      destination={destination}
    />
  )
}
