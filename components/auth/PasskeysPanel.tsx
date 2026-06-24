'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { InlineError } from '@/components/ui/InlineError'
import {
  deletePasskey,
  isPasskeySupported,
  listPasskeys,
  registerPasskey,
  renamePasskey,
} from '@/lib/auth'

type PasskeyListItem = {
  id: string
  friendly_name?: string
  created_at: string
  last_used_at?: string
}

interface PasskeysPanelProps {
  variant?: 'mobile' | 'web'
}

function formatPasskeyDate(value?: string) {
  if (!value) return 'Todavía no usada'

  return new Date(value).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getPasskeyErrorMessage(rawMessage?: string | null) {
  const message = rawMessage?.toLowerCase() ?? ''

  if (!message) return 'No se pudo completar la operación con passkeys.'
  if (message.includes('not support webauthn') || message.includes('browser does not support webauthn')) {
    return 'Este navegador no soporta passkeys/WebAuthn.'
  }
  if (message.includes('secure context')) {
    return 'Passkeys requiere HTTPS o localhost para funcionar.'
  }
  if (message.includes('anonymous')) {
    return 'Primero convertí esta cuenta en una cuenta permanente para poder registrar una passkey.'
  }
  if (message.includes('confirmed')) {
    return 'Necesitás una cuenta confirmada para registrar una passkey.'
  }
  if (message.includes('passkey') && message.includes('disabled')) {
    return 'Passkeys no está habilitado todavía en Supabase. Activá Authentication → Passkeys en el dashboard.'
  }
  if (message.includes('passkey') && message.includes('experimental')) {
    return 'La app todavía no tiene habilitado el modo experimental de passkeys.'
  }
  if (message.includes('abort') || message.includes('cancel')) {
    return 'Cancelaste el proceso antes de terminar.'
  }

  return rawMessage ?? 'No se pudo completar la operación con passkeys.'
}

export function PasskeysPanel({ variant = 'mobile' }: PasskeysPanelProps) {
  const supported = isPasskeySupported()
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([])
  const [isLoading, setIsLoading] = useState(supported)
  const [isRegistering, setIsRegistering] = useState(false)
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null)
  const [draftFriendlyName, setDraftFriendlyName] = useState('')
  const [isSavingName, setIsSavingName] = useState(false)
  const [deletingPasskeyId, setDeletingPasskeyId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const compact = variant === 'mobile'

  const loadPasskeys = async () => {
    if (!supported) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data, error } = await listPasskeys()
    setIsLoading(false)

    if (error) {
      setErrorMessage(getPasskeyErrorMessage(error.message))
      return
    }

    setPasskeys(data ?? [])
  }

  useEffect(() => {
    if (!supported) return

    let cancelled = false

    const boot = async () => {
      setIsLoading(true)
      const { data, error } = await listPasskeys()

      if (cancelled) return

      setIsLoading(false)

      if (error) {
        setErrorMessage(getPasskeyErrorMessage(error.message))
        return
      }

      setPasskeys(data ?? [])
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [supported])

  const startEditing = (passkey: PasskeyListItem) => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setEditingPasskeyId(passkey.id)
    setDraftFriendlyName(passkey.friendly_name ?? '')
  }

  const handleRegister = async () => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsRegistering(true)

    const { error } = await registerPasskey()

    setIsRegistering(false)

    if (error) {
      setErrorMessage(getPasskeyErrorMessage(error.message))
      return
    }

    setSuccessMessage('Passkey registrada. Ya podés usarla para entrar sin Google ni contraseña.')
    await loadPasskeys()
  }

  const handleRename = async () => {
    if (!editingPasskeyId) return

    const friendlyName = draftFriendlyName.trim()
    if (!friendlyName) {
      setErrorMessage('Poné un nombre para identificar esta passkey.')
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSavingName(true)

    const { error } = await renamePasskey(editingPasskeyId, friendlyName)

    setIsSavingName(false)

    if (error) {
      setErrorMessage(getPasskeyErrorMessage(error.message))
      return
    }

    setEditingPasskeyId(null)
    setDraftFriendlyName('')
    setSuccessMessage('Nombre actualizado.')
    await loadPasskeys()
  }

  const handleDelete = async (passkeyId: string) => {
    if (!window.confirm('¿Eliminar esta passkey? Vas a dejar de poder usar este dispositivo para entrar.')) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setDeletingPasskeyId(passkeyId)

    const { error } = await deletePasskey(passkeyId)

    setDeletingPasskeyId(null)

    if (error) {
      setErrorMessage(getPasskeyErrorMessage(error.message))
      return
    }

    setSuccessMessage('Passkey eliminada.')
    await loadPasskeys()
  }

  return (
    <div className={compact ? 'space-y-3' : 'rounded-2xl bg-bg-secondary px-5 py-4'}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-medium text-text-primary ${compact ? 'text-sm' : 'text-[15px]'}`}>
            Passkeys
          </p>
          <p className={`mt-1 text-text-tertiary ${compact ? 'text-xs' : 'text-[13px]'}`}>
            Entrá con biometría, PIN o tu llavero del dispositivo, sin depender de Google.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRegister}
          disabled={!supported || isRegistering}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-button px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
            compact
              ? 'border border-border-ocean text-primary hover:bg-primary/5'
              : 'bg-white text-primary shadow-sm hover:bg-primary-soft'
          }`}
        >
          <Plus size={14} weight="bold" />
          {isRegistering ? 'Registrando...' : 'Agregar'}
        </button>
      </div>

      {!supported && (
        <div className="rounded-input border border-warning/20 bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
          Este navegador o contexto no soporta passkeys. Probá desde HTTPS, Safari, Chrome o Edge actualizados.
        </div>
      )}

      {isLoading ? (
        <div className={`rounded-input px-3 py-3 text-text-tertiary ${compact ? 'bg-bg-secondary text-xs' : 'bg-white text-[13px]'}`}>
          Cargando passkeys...
        </div>
      ) : passkeys.length === 0 ? (
        <div className={`rounded-input px-3 py-3 ${compact ? 'bg-bg-secondary' : 'bg-white'}`}>
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Fingerprint size={16} weight="regular" />
            </div>
            <div>
              <p className={`font-medium text-text-primary ${compact ? 'text-sm' : 'text-[14px]'}`}>
                Todavía no registraste ninguna
              </p>
              <p className={`mt-1 text-text-tertiary ${compact ? 'text-xs' : 'text-[13px]'}`}>
                Agregá una passkey desde este dispositivo y después vas a poder entrar escaneando un QR o usando biometría.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {passkeys.map((passkey, index) => {
            const isEditing = editingPasskeyId === passkey.id
            const isDeleting = deletingPasskeyId === passkey.id
            const title = passkey.friendly_name?.trim() || `Passkey ${index + 1}`

            return (
              <div
                key={passkey.id}
                className={`rounded-input border border-border-ocean/70 px-3 py-3 ${compact ? 'bg-bg-secondary' : 'bg-white'}`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={draftFriendlyName}
                      onChange={(event) => setDraftFriendlyName(event.target.value)}
                      placeholder="Ej: iPhone personal"
                      className="w-full rounded-input border border-border-ocean bg-white px-3 py-2.5 text-sm text-text-primary outline-none"
                      maxLength={120}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPasskeyId(null)
                          setDraftFriendlyName('')
                        }}
                        className="flex-1 rounded-button border border-border-ocean py-2 text-xs font-medium text-text-secondary transition-colors hover:bg-primary/5"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleRename}
                        disabled={isSavingName}
                        className="flex-1 rounded-button bg-primary py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {isSavingName ? 'Guardando...' : 'Guardar nombre'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Fingerprint size={18} weight="regular" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate font-medium text-text-primary ${compact ? 'text-sm' : 'text-[14px]'}`}>
                        {title}
                      </p>
                      <p className={`mt-1 text-text-tertiary ${compact ? 'text-xs' : 'text-[13px]'}`}>
                        Creada {formatPasskeyDate(passkey.created_at)}
                      </p>
                      <p className={`mt-0.5 text-text-tertiary ${compact ? 'text-xs' : 'text-[13px]'}`}>
                        Último uso: {formatPasskeyDate(passkey.last_used_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEditing(passkey)}
                        className="rounded-full p-2 text-text-secondary transition-colors hover:bg-primary/5 hover:text-primary"
                        aria-label="Editar nombre de passkey"
                      >
                        <PencilSimple size={15} weight="regular" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(passkey.id)}
                        disabled={isDeleting}
                        className="rounded-full p-2 text-text-secondary transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                        aria-label="Eliminar passkey"
                      >
                        <Trash size={15} weight="regular" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <InlineError message={errorMessage} />

      {successMessage && <p className="text-xs font-medium text-success">{successMessage}</p>}
    </div>
  )
}
