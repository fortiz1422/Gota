import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginButton } from '@/app/(auth)/login/LoginButton'

export default async function StartPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/')
  return <LoginButton initialScreen="explore" />
}
