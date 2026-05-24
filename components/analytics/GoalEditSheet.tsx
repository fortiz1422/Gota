'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/Modal'
import type { GoalWithMetrics } from '@/lib/goals/types'

interface Props {
  open: boolean
  goal: GoalWithMetrics | null
  onClose: () => void
  onSaved: () => void
}

export function GoalEditSheet({ open, goal, onClose, onSaved }: Props) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [plannedMonthly, setPlannedMonthly] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Pre-fill fields when goal changes
  useEffect(() => {
    if (goal) {
      setName(goal.name)
      setEmoji(goal.emoji ?? '')
      setTargetAmount(String(goal.targetAmount))
      setTargetDate(goal.targetDate ?? '')
      setPlannedMonthly(goal.plannedMonthlyContribution ? String(goal.plannedMonthlyContribution) : '')
      setNotes(goal.notes ?? '')
      setError(null)
    }
  }, [goal])

  function handleClose() {
    setError(null)
    onClose()
  }

  async function handleSave() {
    if (!goal) return
    if (!name.trim()) { setError('El nombre es obligatorio.'); return }
    const target = Number(targetAmount)
    if (!target || target <= 0) { setError('El monto objetivo debe ser mayor a cero.'); return }

    setError(null)
    setIsSaving(true)

    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          emoji: emoji.trim() || null,
          targetAmount: target,
          targetDate: targetDate || null,
          plannedMonthlyContribution: plannedMonthly ? Number(plannedMonthly) : null,
          notes: notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'No se pudo guardar la meta.')
      }

      onSaved()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la meta.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!open || !goal) return null

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
      <h2 className="text-[17px] font-semibold text-text-primary">Editar meta</h2>
      <p className="mt-1 text-[12px] text-text-tertiary">
        La moneda no se puede cambiar porque afectaría los aportes registrados.
      </p>

      <div className="mt-5 space-y-3">
        {/* Nombre + emoji */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="✦"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={4}
            className="w-14 rounded-input border border-transparent bg-bg-tertiary px-3 py-3 text-center text-[18px] focus:border-primary focus:outline-none"
          />
          <input
            type="text"
            placeholder="Nombre de la meta"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="flex-1 rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-[14px] text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
          />
        </div>

        {/* Moneda (read-only) */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Moneda
          </label>
          <div className="flex items-center rounded-input bg-bg-tertiary px-4 py-3">
            <span className="text-[14px] font-semibold text-text-secondary">{goal.currency}</span>
            <span className="ml-2 text-[12px] text-text-muted">(no editable)</span>
          </div>
        </div>

        {/* Monto objetivo */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Monto objetivo
          </label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-[14px] text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
          />
        </div>

        {/* Fecha objetivo (opcional) */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Fecha objetivo <span className="normal-case font-normal">(opcional)</span>
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-[14px] text-text-primary focus:border-primary focus:outline-none"
          />
        </div>

        {/* Aporte mensual planeado (opcional) */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Aporte mensual planeado <span className="normal-case font-normal">(opcional)</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={plannedMonthly}
            onChange={(e) => setPlannedMonthly(e.target.value)}
            className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-[14px] text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
          />
        </div>

        {/* Notas (opcional) */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Nota <span className="normal-case font-normal">(opcional)</span>
          </label>
          <textarea
            placeholder="Ej: Pasajes + estadía"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={2}
            className="w-full resize-none rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-[14px] text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
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
