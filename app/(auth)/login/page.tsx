import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { safeDestination } from '@/lib/auth-destination'
import { AnonymousLogin } from '@/components/auth/AnonymousLogin'
import { LoginButton } from './LoginButton'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeDestination((await searchParams).next)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user?.is_anonymous) return <AnonymousLogin destination={next} />
  if (user) redirect(next)

  return <LoginButton destination={next} />
}
