import { safeDestination } from '@/lib/auth-destination'
import { createClient } from '@/lib/supabase/server'
import { recordProductEvent } from '@/lib/product-analytics/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const authIntent = requestUrl.searchParams.get('auth_intent')
  const next = requestUrl.searchParams.get('next')

  const failure = () => NextResponse.redirect(new URL('/auth/error', request.url))
  // A callback is successful only after exchanging the code and validating
  // the resulting user. Never silently fall through to an anonymous session.
  if (!code || requestUrl.searchParams.has('error')) return failure()

  try {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) return failure()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user || user.is_anonymous) return failure()
    if (authIntent === 'link_google') {
      try {
        await recordProductEvent(supabase, user.id, 'anonymous_link_completed', {
          provider: 'google',
        })
      } catch {
        // Analytics must not turn a verified sign-in into an auth failure.
      }
    }
  } catch {
    return failure()
  }

  const fallbackNext = authIntent === 'anon_email_upgrade' ? '/auth/create-password' : '/'
  return NextResponse.redirect(new URL(safeDestination(next, fallbackNext), requestUrl.origin))
}
