'use client'

import { useEffect, useState } from 'react'
import { Bank } from '@phosphor-icons/react'
import { ManagementSurface } from '@/components/ui/ManagementSurface'
import { AccountsSection } from '@/components/settings/AccountsSection'
import { getCurrentMonth } from '@/lib/dates'
import type { Account } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  onChanged?: () => void
}

export function CuentasSubSheet({ open, onClose, onChanged }: Props) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch('/api/accounts', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error()
        return response.json()
      })
      .then((data: Account[]) => {
        if (!cancelled) setAccounts(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setError('No pudimos cargar tus cuentas.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [loadAttempt, open])

  const handleClose = () => {
    setLoading(true)
    setError(null)
    onClose()
  }

  return (
    <ManagementSurface open={open} onClose={handleClose} eyebrow="TU PLATA" title="Cuentas" description="Administrá dónde está tu dinero y su punto de partida.">
      {loading ? (
        <div className="space-y-2" aria-label="Cargando cuentas">{[0, 1, 2].map((item) => <div key={item} className="h-[72px] animate-pulse rounded-card bg-bg-tertiary" />)}</div>
      ) : error ? (
        <div className="rounded-card border border-border-subtle px-5 py-8 text-center" role="alert">
          <Bank size={24} className="mx-auto text-text-tertiary" />
          <p className="mt-3 text-sm font-semibold text-text-primary">No pudimos cargar las cuentas</p>
          <p className="mt-1 text-xs text-text-tertiary">{error}</p>
          <button type="button" onClick={() => { setLoading(true); setError(null); setLoadAttempt((attempt) => attempt + 1) }} className="mt-4 min-h-11 rounded-button border border-primary px-5 text-sm font-semibold text-primary">Reintentar</button>
        </div>
      ) : (
        <AccountsSection key={loadAttempt} initialAccounts={accounts} month={getCurrentMonth()} standalone onChanged={onChanged} />
      )}
    </ManagementSurface>
  )
}
