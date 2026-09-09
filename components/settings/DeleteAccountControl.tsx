'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Warning } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { InlineError } from '@/components/ui/InlineError'
import { TaskSurface } from '@/components/ui/TaskSurface'

const DELETE_CONFIRMATION = 'ELIMINAR'

export function DeleteAccountControl() {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const canDelete = confirmation.trim().toUpperCase() === DELETE_CONFIRMATION

  const resetConfirm = () => {
    if (isDeleting) return
    setShowConfirm(false)
    setConfirmation('')
    setDeleteError(null)
  }

  const handleDeleteAccount = async () => {
    if (!canDelete || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch('/api/account', { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
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

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setShowConfirm(true)} className="w-full rounded-button bg-danger/10 py-3 text-left text-sm font-medium text-danger transition-colors hover:bg-danger/20">
        Eliminar mi cuenta
      </button>

      <TaskSurface
        open={showConfirm}
        onClose={resetConfirm}
        appearance="compact"
        navigationTitle="Eliminar cuenta"
        triggerRef={triggerRef}
        initialFocusRef={inputRef}
        eyebrow="PRIVACIDAD Y DATOS"
        title="Eliminar mi cuenta"
        description="Esta acción es irreversible. Se eliminan tus datos financieros y tu usuario."
        footer={
          <button type="button" onClick={() => void handleDeleteAccount()} disabled={!canDelete || isDeleting} className="w-full rounded-button bg-danger py-3 text-sm font-semibold text-white disabled:opacity-50">
            {isDeleting ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-3 rounded-card border border-danger/20 bg-danger/10 p-4">
            <Warning size={21} weight="fill" className="shrink-0 text-danger" />
            <p className="text-sm leading-6 text-danger">No vas a poder recuperar cuentas, tarjetas, movimientos ni preferencias.</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-text-secondary">Escribí ELIMINAR para confirmar</span>
            <input ref={inputRef} type="text" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setDeleteError(null) }} disabled={isDeleting} autoComplete="off" className="w-full border-0 border-b border-danger/40 bg-transparent px-0 pb-2 pt-1 text-base font-semibold text-text-primary outline-none focus:border-danger focus:ring-0 disabled:opacity-50" />
          </label>
          <InlineError message={deleteError} />
        </div>
      </TaskSurface>
    </>
  )
}
