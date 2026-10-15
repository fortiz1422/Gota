import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveStartDestination } from '@/lib/start-entry'
import { StartAnonymousSession } from './StartAnonymousSession'

export default async function StartPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: config } = await supabase
      .from('user_config')
      .select('onboarding_completed')
      .eq('user_id', user.id)
      .maybeSingle()
    const destination = resolveStartDestination({
      hasUser: true,
      onboardingCompleted: config?.onboarding_completed === true,
    })
    redirect(destination === 'create-anonymous' ? '/onboarding' : destination)
  }

  return <StartAnonymousSession />
}
