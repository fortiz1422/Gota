import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBalanceBreakdown } from '@/lib/current-account-balance'
import { sumLiveBreakdown } from '@/lib/live-balance'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const currency = (searchParams.get('currency') === 'USD' ? 'USD' : 'ARS') as 'ARS' | 'USD'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const breakdown = await getCurrentBalanceBreakdown({
    supabase,
    userId: user.id,
    currency,
  })

  return NextResponse.json({
    breakdown,
    total: sumLiveBreakdown(breakdown),
    currency,
  })
}
