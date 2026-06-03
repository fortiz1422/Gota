'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { todayAR } from '@/lib/format'
import type { GoalContribution } from '@/lib/goals/types'
import type { Currency } from '@/types/database'

interface Props {
  open: boolean
  goalId: string
  goalCurrency: Currency
  contribution: GoalContribution | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}

export function GoalContributionEditSheet({
  open,
  goalId,
  goalCurrency,
  contribution,
  onClose,
  onSaved,
}: Props) {
  const [amount, setAmount] = useState('')
  const [contributedAt, setContributedAt] = useState(todayAR())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !contribution) return
    setAmount(String(contribution.amount))
    setContributedAt(contribution.contributedAt)
    setNote(contribution.note ?? '')
    setError(null)
  }, [contribution, open])

  function handleClose() {
    setError(null)
    setIsSaving(false)
    onClose()
  }

  async function handleSave() {
    if (!contribution) return
    const parsedAmount = Number(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      setError('El monto debe ser mayor a cero.')
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      const res = await fetch(`/api/goals/${goalId}/contributions/${contribution.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parsedAmount,
          contributedAt,
          note: note.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'No se pudo editar el aporte.')
      }

      await onSaved()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo editar el aporte.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!open || !contribution) return null

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
        Editar aporte manual
      </p>
      <p className="mt-1 text-[15px] font-semibold text-text-primary">
        Ajustá monto, fecha o nota sin rehacer el registro.
      </p>
      <p className="mt-2 text-[12px] text-text-tertiary">
        Moneda: <span className="font-semibold text-text-secondary">{goalCurrency}</span>
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Monto ({goalCurrency})
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-[14px] text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Fecha
          </label>
          <input
            type="date"
            value={contributedAt}
            onChange={(event) => setContributedAt(event.target.value)}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-[14px] text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Nota <span className="normal-case font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-[14px] text-text-primary focus:border-primary focus:outline-none"
          />
        </div>
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
          {isSaving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </Modal>
  )
}
