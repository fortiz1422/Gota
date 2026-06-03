'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { todayAR } from '@/lib/format'
import type { GoalWithMetrics } from '@/lib/goals/types'

type SourceAccount = {
  id: string
  name: string
  type: 'bank' | 'cash' | 'digital'
  isPrimary: boolean
}

interface Props {
  open: boolean
  goal: GoalWithMetrics | null
  onClose: () => void
  onContributed: () => void
}

function accountTypeLabel(type: SourceAccount['type']) {
  if (type === 'cash') return 'Efectivo'
  if (type === 'digital') return 'Digital'
  return 'Banco'
}

export function GoalContributionSheet({ open, goal, onClose, onContributed }: Props) {
  const [amount, setAmount] = useState('')
  const [contributedAt, setContributedAt] = useState(todayAR())
  const [note, setNote] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [availabilityEffect, setAvailabilityEffect] = useState<'none' | 'committed_only'>('none')
  const [sourceAccountId, setSourceAccountId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const { data: accountsData } = useQuery<{ accounts: SourceAccount[] }>({
    queryKey: ['goal-source-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/goals/source-accounts')
      if (!res.ok) throw new Error('accounts fetch failed')
      return res.json()
    },
    enabled: open,
    staleTime: 60_000,
  })

  const accounts = useMemo(() => accountsData?.accounts ?? [], [accountsData?.accounts])
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === sourceAccountId) ?? null,
    [accounts, sourceAccountId],
  )

  useEffect(() => {
    if (!open) return
    setContributedAt(todayAR())
  }, [open])

  useEffect(() => {
    if (availabilityEffect === 'none') {
      setSourceAccountId(null)
      return
    }

    if (!sourceAccountId && accounts.length > 0) {
      setSourceAccountId(accounts[0].id)
    }
  }, [accounts, availabilityEffect, sourceAccountId])

  function reset() {
    setAmount('')
    setContributedAt(todayAR())
    setNote('')
    setAdvancedOpen(false)
    setAvailabilityEffect('none')
    setSourceAccountId(null)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSave() {
    if (!goal) return
    const parsed = Number(amount)
    if (!parsed || parsed <= 0) {
      setError('El monto debe ser mayor a cero.')
      return
    }

    if (availabilityEffect === 'committed_only' && !sourceAccountId) {
      setError('Elegí la cuenta donde queda comprometida esa plata.')
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      const res = await fetch(`/api/goals/${goal.id}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsed,
          currency: goal.currency,
          contributedAt,
          sourceType: 'manual',
          sourceAccountId: availabilityEffect === 'committed_only' ? sourceAccountId : null,
          availabilityEffect,
          destinationKind: availabilityEffect === 'committed_only' ? 'same_account' : null,
          note: note.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'No se pudo registrar el aporte.')
      }

      onContributed()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el aporte.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!open || !goal) return null

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
      <div className="mb-4 flex items-center gap-2">
        {goal.emoji ? <span className="text-[20px]">{goal.emoji}</span> : null}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Registrar aporte
          </p>
          <p className="text-[15px] font-semibold text-text-primary">{goal.name}</p>
        </div>
      </div>

      <p className="mb-4 text-[12px] text-text-tertiary">
        Happy path: registrar progreso sin tocar tu Disponible real. Si querés, podés abrir el detalle y dejarlo comprometido dentro de una cuenta.
      </p>

      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Monto ({goal.currency})
          </label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-[14px] text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Fecha
          </label>
          <input
            type="date"
            value={contributedAt}
            onChange={(e) => setContributedAt(e.target.value)}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-[14px] text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Nota <span className="normal-case font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            placeholder="Ej: Separé parte del aguinaldo"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-[14px] text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 rounded-card border border-border-subtle bg-bg-secondary px-4 py-3.5">
        <button
          type="button"
          onClick={() => setAdvancedOpen((current) => !current)}
          className="flex w-full items-center justify-between text-left"
        >
          <div>
            <p className="text-[12px] font-semibold text-text-primary">Quiero definir qué pasa con esa plata</p>
            <p className="mt-1 text-[12px] text-text-tertiary">
              {availabilityEffect === 'committed_only'
                ? 'Queda comprometida dentro de una cuenta existente.'
                : 'Solo suma progreso por ahora.'}
            </p>
          </div>
          <span className="text-[12px] font-semibold text-primary">{advancedOpen ? 'Ocultar' : 'Configurar'}</span>
        </button>

        {advancedOpen ? (
          <div className="mt-4 space-y-3 border-t border-separator pt-4">
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setAvailabilityEffect('none')}
                className={`w-full rounded-card border px-3 py-3 text-left ${
                  availabilityEffect === 'none'
                    ? 'border-primary bg-primary/10'
                    : 'border-border-subtle bg-white'
                }`}
              >
                <p className="text-[13px] font-semibold text-text-primary">Solo registrar el avance</p>
                <p className="mt-1 text-[12px] text-text-tertiary">
                  No cambia lecturas de disponibilidad. Es el camino por defecto.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setAvailabilityEffect('committed_only')}
                className={`w-full rounded-card border px-3 py-3 text-left ${
                  availabilityEffect === 'committed_only'
                    ? 'border-primary bg-primary/10'
                    : 'border-border-subtle bg-white'
                }`}
              >
                <p className="text-[13px] font-semibold text-text-primary">Dejarla comprometida dentro de una cuenta</p>
                <p className="mt-1 text-[12px] text-text-tertiary">
                  Baja tu Disponible libre, pero no toca Saldo Vivo ni Disponible real.
                </p>
              </button>
            </div>

            {availabilityEffect === 'committed_only' ? (
              <div>
                <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                  Cuenta origen
                </label>
                <div className="space-y-2">
                  {accounts.map((account) => {
                    const isSelected = sourceAccountId === account.id
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => setSourceAccountId(account.id)}
                        className={`flex w-full items-center justify-between rounded-card border px-3 py-3 text-left ${
                          isSelected ? 'border-primary bg-primary/10' : 'border-border-subtle bg-white'
                        }`}
                      >
                        <div>
                          <p className="text-[13px] font-semibold text-text-primary">{account.name}</p>
                          <p className="mt-1 text-[12px] text-text-tertiary">
                            {accountTypeLabel(account.type)}{account.isPrimary ? ' · principal' : ''}
                          </p>
                        </div>
                        {isSelected ? <span className="text-[12px] font-semibold text-primary">Elegida</span> : null}
                      </button>
                    )
                  })}
                </div>
                {selectedAccount ? (
                  <p className="mt-2 text-[12px] text-text-tertiary">
                    Queda asociado a <span className="font-medium text-text-secondary">{selectedAccount.name}</span>.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-[13px] text-danger">{error}</p> : null}

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={handleClose}
          className="flex-1 rounded-button border border-border-ocean px-4 py-3 text-[13px] font-semibold text-text-primary"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 rounded-button bg-primary px-4 py-3 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {isSaving ? 'Registrando...' : 'Registrar'}
        </button>
      </div>
    </Modal>
  )
}
