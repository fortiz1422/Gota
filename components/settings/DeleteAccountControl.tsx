'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { InlineError } from '@/components/ui/InlineError'

const DELETE_CONFIRMATION = 'ELIMINAR'

export function DeleteAccountControl() {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const canDelete = confirmation.trim().toUpperCase() === DELETE_CONFIRMATION

  const resetConfirm = () => {
    setShowConfirm(false)
    setConfirmation('')
    setDeleteError(null)
  }

  const handleDeleteAccount = async () => {
    if (!canDelete || isDeleting) return

    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/account', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Error al eliminar la cuenta')
      }

      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Error al eliminar la cuenta')
      setIsDeleting(false)
    }
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => setShowConfirm(true)}
        className="w-full rounded-button bg-danger/10 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/20"
      >
        Eliminar mi cuenta
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-card bg-danger/10 p-3">
      <p className="text-xs font-medium text-danger">
        Esta accion es irreversible. Se eliminaran tus datos financieros y tu usuario.
      </p>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-danger">
          Escribi ELIMINAR para confirmar
        </label>
        <input
          type="text"
          value={confirmation}
          onChange={(e) => {
            setConfirmation(e.target.value)
            setDeleteError(null)
          }}
          disabled={isDeleting}
          className="w-full rounded-input border border-danger/20 bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-danger disabled:opacity-50"
          autoComplete="off"
        />
      </div>

      <InlineError message={deleteError} />

      <div className="flex gap-2">
        <button
          onClick={resetConfirm}
          disabled={isDeleting}
          className="flex-1 rounded-button py-2 text-xs text-text-secondary transition-colors hover:bg-primary/5 disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleDeleteAccount}
          disabled={!canDelete || isDeleting}
          className="flex-1 rounded-button bg-danger py-2 text-xs font-semibold text-bg-primary disabled:opacity-50"
        >
          {isDeleting ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </div>
  )
}
