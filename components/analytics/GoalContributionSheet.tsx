'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { todayAR } from '@/lib/format'
import type { GoalWithMetrics } from '@/lib/goals/types'

interface Props {
  open: boolean
  goal: GoalWithMetrics | null
  onClose: () => void
  onContributed: () => void
}

export function GoalContributionSheet({ open, goal, onClose, onContributed }: Props) {
  const [amount, setAmount] = useState('')
  const [contributedAt, setContributedAt] = useState(todayAR())
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  function reset() {
    setAmount('')
    setContributedAt(todayAR())
    setNote('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSave() {
    if (!goal) return
    const parsed = Number(amount)
    if (!parsed || parsed <= 0) { setError('El monto debe ser mayor a cero.'); return }

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
        Moneda: <span className="font-semibold text-text-secondary">{goal.currency}</span>
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
