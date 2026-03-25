import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingFlow } from './OnboardingFlow'
import { getCurrentMonth } from '@/lib/dates'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: config } = await supabase
    .from('user_config')
    .select('onboarding_completed, default_currency')
    .eq('user_id', user.id)
    .single()

  if (config?.onboarding_completed) redirect('/')

  const currency = (config?.default_currency ?? 'ARS') as 'ARS' | 'USD'
  const currentMonth = getCurrentMonth()

  return <OnboardingFlow initialCurrency={currency} currentMonth={currentMonth} />
}
