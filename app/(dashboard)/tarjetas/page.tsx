import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Account, Card } from '@/types/database'
import { TarjetasClient } from './TarjetasClient'

export default async function TarjetasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: cards }, { data: accounts }] = await Promise.all([
    supabase.from('cards').select('*').eq('user_id', user.id).eq('archived', false).order('created_at', { ascending: true }),
    supabase.from('accounts').select('*').eq('user_id', user.id).eq('archived', false).order('created_at', { ascending: true }),
  ])

  return <TarjetasClient cards={(cards ?? []) as Card[]} accounts={(accounts ?? []) as Account[]} />
}
