'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DeleteAccountControl } from '@/components/settings/DeleteAccountControl'

export function AccountSection({ email }: { email: string }) {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div
      className="space-y-3 rounded-card p-4"
      style={{
        background: 'rgba(255,255,255,0.38)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.70)',
      }}
    >
      <p className="rounded-input bg-bg-tertiary px-3 py-2.5 text-sm text-text-primary">
        {email}
      </p>

      <div className="rounded-input bg-bg-tertiary px-3 py-2.5">
        <Link
          href="/privacy"
          className="block text-sm font-medium text-text-primary transition-colors hover:text-primary"
        >
          Privacidad y datos
        </Link>
        <p className="mt-1 text-xs text-text-tertiary">
          SmartInput usa IA para interpretar el texto que escribis y proponer un gasto editable.
        </p>
      </div>

      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="w-full rounded-button py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
      >
        {isLoggingOut ? 'Cerrando...' : 'Cerrar sesion'}
      </button>

      <DeleteAccountControl />
    </div>
  )
}
