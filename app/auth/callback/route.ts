import { createClient } from '@/lib/supabase/server'
import { recordProductEvent } from '@/lib/product-analytics/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const authIntent = requestUrl.searchParams.get('auth_intent')
  const next = requestUrl.searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
    if (authIntent === 'link_google') {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        await recordProductEvent(supabase, user.id, 'anonymous_link_completed', {
          provider: 'google',
        })
      }
    }
  }

  const fallbackNext = authIntent === 'anon_email_upgrade' ? '/auth/create-password' : '/'
  const safeNext = next && next.startsWith('/') ? next : fallbackNext
  return NextResponse.redirect(new URL(safeNext, request.url))
}
