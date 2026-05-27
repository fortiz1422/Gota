import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import { BlueHeaderZone } from '@/components/ui/BlueHeaderZone'
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
    <div className="min-h-screen bg-bg-primary">
      <BlueHeaderZone
        className="flex flex-col items-center justify-end pb-10"
        style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 220 }}
      >
        <Image
          src="/gota-wordmark.png"
          alt="Gota"
          width={160}
          height={214}
          className="mb-3 brightness-0 invert"
          priority
        />
        <p className="text-sm text-white/60">gota, tu plata clara</p>
      </BlueHeaderZone>

      <div className="mx-auto max-w-sm px-4" style={{ marginTop: -24 }}>
        {error === 'oauth' && (
          <p className="mb-4 text-center text-sm text-danger">
            Error al iniciar sesión. Intentá de nuevo.
          </p>
        )}
        <LoginButton />
      </div>
    </div>
  )
}
