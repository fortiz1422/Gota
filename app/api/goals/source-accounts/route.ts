import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, type, is_primary, archived')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    accounts: (data ?? []).map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      isPrimary: account.is_primary,
    })),
  })
}
