import { firstSetupAccountId } from '@/lib/onboarding-account-id'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AccountIdentitySchema } from '@/lib/account-input'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = AccountIdentitySchema.required().safeParse(body)
  if (!parsed.success)
    return NextResponse.json(
      { error: 'Completá la cuenta y sus saldos con valores válidos.' },
      { status: 400 }
    )

  const { data: config, error: configError } = await supabase
    .from('user_config')
    .select('onboarding_completed')
    .eq('user_id', user.id)
    .maybeSingle()
  if (configError)
    return NextResponse.json(
      { error: 'No pudimos consultar tu configuración.' },
      { status: 500 }
    )
  // A stale tab/retry must never replace a completed user's financial balances.
  if (config?.onboarding_completed)
    return NextResponse.json({ completed: true })

  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id,is_primary')
    .eq('user_id', user.id)
    .eq('archived', false)
    .order('created_at', { ascending: true })
  if (accountsError)
    return NextResponse.json(
      { error: 'No pudimos consultar tus cuentas.' },
      { status: 500 }
    )
  const existing =
    accounts?.find((account) => account.is_primary) ?? accounts?.[0]
  const { data, error } = await supabase
    .from('accounts')
    .upsert(
      {
        id: existing?.id ?? firstSetupAccountId(user.id),
        user_id: user.id,
        ...parsed.data,
        is_primary: true,
      },
      { onConflict: 'id' }
    )
    .select()
    .single()
  if (error)
    return NextResponse.json(
      { error: 'No pudimos guardar la cuenta.' },
      { status: 500 }
    )
  return NextResponse.json(data)
}
