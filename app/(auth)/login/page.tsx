import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { LoginButton } from './LoginButton'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) redirect('/')

  const { error } = await searchParams

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/logo-login.png"
          alt="Gota"
          width={80}
          height={80}
          className="mb-5 mx-auto"
          priority
        />
        <h1 className="mb-2 text-3xl font-light tracking-wide text-text-primary">
          Gota
        </h1>
        <p className="mb-10 text-sm text-text-tertiary">
          Tus gastos, sin fricción
        </p>

        {error === 'oauth' && (
          <p className="mb-4 text-sm text-danger">
            Error al iniciar sesión. Intentá de nuevo.
          </p>
        )}

        <LoginButton />
      </div>
    </div>
  )
}
