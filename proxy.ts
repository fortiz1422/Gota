import { safeDestination } from '@/lib/auth-destination'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * These exact device routes have independent bearer-token auth in their route
 * handlers; no other API is public.
 */
export function isDeviceSnapshotPath(pathname: string): boolean {
  return (
    pathname === '/api/device/v1/snapshot' ||
    pathname === '/api/shortcut/v1/receipts'
  )
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isPublicPath =
    pathname === '/landing' ||
    pathname.startsWith('/landing/') ||
    pathname === '/terms' ||
    pathname === '/privacy' ||
    pathname.startsWith('/privacy/')

  // Public product pages work without auth and never refresh a personal session.
  if (isPublicPath) return NextResponse.next()

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Backend polling uses CRON_SECRET in its handler, never a browser session.
  // Match exactly: other integration/admin routes still require user auth.
  if (pathname === '/api/cron/mercadopago-sync') return response

  // Solo en desarrollo: la ruta de exploración visual no requiere sesión.
  // En producción sigue detrás de auth como cualquier otra página.
  if (
    process.env.NODE_ENV === 'development' &&
    request.nextUrl.pathname.startsWith('/ui-exploration')
  ) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirigir a /login si no está autenticado
  // Excluir /auth/callback para que el intercambio de código OAuth pueda ejecutarse
  if (
    !user &&
    !isPublicPath &&
    !isDeviceSnapshotPath(pathname) &&
    pathname !== '/start' &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth/') &&
    !request.nextUrl.pathname.startsWith('/share-target')
  ) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (pathname === '/') {
      // Root varies by validated session. Never cache either variant publicly.
      const landing = request.nextUrl.clone()
      landing.pathname = '/landing'
      const publicResponse = NextResponse.rewrite(landing)
      response.cookies.getAll().forEach(cookie => publicResponse.cookies.set(cookie))
      publicResponse.headers.set('Cache-Control', 'private, no-store')
      return publicResponse
    }
    const login = new URL('/login', request.url)
    login.searchParams.set('next', safeDestination(pathname + request.nextUrl.search))
    return NextResponse.redirect(login)
  }

  // Redirigir al dashboard si ya está autenticado y va a /login
  if (user && !user.is_anonymous && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL(safeDestination(request.nextUrl.searchParams.get('next')), request.url))
  }

  if (pathname === '/') response.headers.set('Cache-Control', 'private, no-store')
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
