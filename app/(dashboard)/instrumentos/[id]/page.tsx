import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { todayAR } from '@/lib/format'
import { FF_INSTRUMENTS } from '@/lib/flags'
import { InstrumentoDetailClient } from '@/components/instruments/InstrumentoDetailClient'
import type { Account, Instrument } from '@/types/database'

export default async function InstrumentoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!FF_INSTRUMENTS) redirect('/')

  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: instrumentData }, { data: accountsData }] = await Promise.all([
    supabase
      .from('instruments')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  if (!instrumentData) redirect('/instrumentos')

  return (
    <InstrumentoDetailClient
      instrument={instrumentData as Instrument}
      accounts={(accountsData ?? []) as Account[]}
      today={todayAR()}
    />
  )
}
