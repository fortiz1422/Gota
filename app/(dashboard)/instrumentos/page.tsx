import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentMonth } from '@/lib/dates'
import { todayAR } from '@/lib/format'
import { FF_INSTRUMENTS } from '@/lib/flags'
import { InstrumentosPageClient } from '@/components/instruments/InstrumentosPageClient'
import type { Account, Instrument } from '@/types/database'

export default async function InstrumentosPage() {
  if (!FF_INSTRUMENTS) redirect('/')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: instrumentsData }, { data: accountsData }] = await Promise.all([
    supabase
      .from('instruments')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('opened_at', { ascending: false }),
    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  const instruments = (instrumentsData ?? []) as Instrument[]
  const accounts = (accountsData ?? []) as Account[]

  return (
    <InstrumentosPageClient
      instruments={instruments}
      accounts={accounts}
      today={todayAR()}
      currentMonth={getCurrentMonth()}
    />
  )
}
