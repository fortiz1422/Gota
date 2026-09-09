'use client'

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { CalendarBlank, LockSimple, NotePencil, Sparkle } from '@phosphor-icons/react'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { InlineError } from '@/components/ui/InlineError'
import { formatArDecimal, parseArDecimalInput } from '@/lib/ar-input'
import type { GoalWithMetrics } from '@/lib/goals/types'

interface Props {
  open: boolean
  goal: GoalWithMetrics | null
  onClose: () => void
  onSaved: () => void
  triggerRef?: RefObject<HTMLElement | null>
}

function OptionalLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
      {children} <span className="normal-case font-normal">(opcional)</span>
    </label>
  )
}

export function GoalEditSheet({ open, goal, onClose, onSaved, triggerRef }: Props) {
  const nameId = useId()
  const targetAmountId = useId()
  const targetDateId = useId()
  const plannedMonthlyId = useId()
  const notesId = useId()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [plannedMonthly, setPlannedMonthly] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!goal) return

    setName(goal.name)
    setEmoji(goal.emoji ?? '')
    setTargetAmount(String(goal.targetAmount))
    setTargetDate(goal.targetDate ?? '')
    setPlannedMonthly(goal.plannedMonthlyContribution ? String(goal.plannedMonthlyContribution) : '')
    setNotes(goal.notes ?? '')
    setError(null)
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

  const currencySymbol = goal.currency === 'ARS' ? '$' : 'US$'
  return (
    <TaskSurface
      open={open}
      onClose={handleClose}
      eyebrow="PLANIFICAR"
      title="Editar meta"
      description="Ajustá el objetivo o el plan. Los aportes ya registrados no cambian."
      initialFocusRef={nameInputRef}
      triggerRef={triggerRef}
      footer={(
        <>
          <InlineError message={error} className="mb-3" />
          <button
            type="button"
            onClick={() => { void handleSave() }}
            disabled={isSaving}
            className="min-h-12 w-full rounded-button bg-primary px-4 type-body-lg text-white transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isSaving ? 'Guardando cambios…' : 'Guardar cambios'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="mt-1 min-h-11 w-full type-body text-text-tertiary disabled:opacity-50"
          >
            Cancelar
          </button>
        </>
      )}
    >
      <section className="card-s5 px-4 pb-5 pt-4" aria-labelledby={`${nameId}-section`}>
        <p id={`${nameId}-section`} className="type-micro text-primary">META</p>

        <div className="mt-4 flex gap-2">
          <label className="sr-only" htmlFor={`${nameId}-emoji`}>Símbolo</label>
          <input
            id={`${nameId}-emoji`}
            type="text"
            placeholder="✦"
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
            maxLength={4}
            className="h-14 w-14 shrink-0 rounded-input border border-border-subtle bg-bg-tertiary px-2 text-center text-[20px]"
          />
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor={nameId}>Nombre de la meta</label>
            <input
              ref={nameInputRef}
              id={nameId}
              type="text"
              placeholder="Ej. Viaje a Japón"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                if (error) setError(null)
              }}
              maxLength={100}
              className="h-14 w-full rounded-input border border-border-subtle bg-bg-tertiary px-4 type-body-lg text-text-primary placeholder:text-text-muted"
            />
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor={targetAmountId} className="mb-2 block type-meta font-semibold text-text-secondary">
            Monto objetivo
          </label>
          <div className="flex min-h-[62px] items-center rounded-input border border-border-subtle bg-bg-primary px-4 focus-within:border-primary">
            <span className="mr-2 type-amount text-text-secondary">{currencySymbol}</span>
            <input
              id={targetAmountId}
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={formatArDecimal(targetAmount)}
              onChange={(event) => {
                setTargetAmount(parseArDecimalInput(event.target.value))
                if (error) setError(null)
              }}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 type-amount text-text-primary outline-none placeholder:text-text-muted focus:ring-0 focus-visible:outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex min-h-12 items-center gap-3 rounded-input bg-bg-tertiary px-4 text-text-secondary">
          <LockSimple size={18} weight="light" className="shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="type-meta font-semibold">Moneda</p>
            <p className="type-body">{goal.currency}</p>
          </div>
          <p className="type-meta text-text-muted">No editable</p>
        </div>
        <p className="mt-2 type-meta text-text-tertiary">
          Cambiarla afectaría la lectura de los aportes registrados.
        </p>
      </section>

      <section className="mt-6" aria-labelledby={`${targetDateId}-section`}>
        <p id={`${targetDateId}-section`} className="mb-3 type-micro text-text-secondary">PLAN</p>
        <div className="border-y border-border-subtle">
          <div className="py-3">
            <OptionalLabel>Fecha objetivo</OptionalLabel>
            <div className="flex min-h-12 items-center gap-3 rounded-input bg-bg-tertiary px-4">
              <CalendarBlank size={18} weight="light" className="shrink-0 text-primary" />
              <input
                id={targetDateId}
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                aria-label="Fecha objetivo opcional"
                className="min-w-0 flex-1 border-0 bg-transparent p-0 type-body text-text-primary outline-none focus:ring-0"
              />
            </div>
          </div>

          <div className="border-t border-border-subtle py-3">
            <OptionalLabel>Aporte mensual planeado</OptionalLabel>
            <div className="flex min-h-12 items-center gap-3 rounded-input bg-bg-tertiary px-4 focus-within:ring-1 focus-within:ring-primary">
              <Sparkle size={18} weight="light" className="shrink-0 text-primary" />
              <span className="type-body text-text-secondary">{currencySymbol}</span>
              <input
                id={plannedMonthlyId}
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={formatArDecimal(plannedMonthly)}
                onChange={(event) => setPlannedMonthly(parseArDecimalInput(event.target.value))}
                aria-label="Aporte mensual planeado opcional"
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-right type-body text-text-primary outline-none placeholder:text-text-muted focus:ring-0 focus-visible:outline-none"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6" aria-labelledby={`${notesId}-section`}>
        <p id={`${notesId}-section`} className="mb-3 type-micro text-text-secondary">CONTEXTO</p>
        <label htmlFor={notesId} className="sr-only">Nota opcional</label>
        <div className="flex items-start gap-3 rounded-input border border-border-subtle bg-bg-tertiary px-4 py-3 focus-within:border-primary">
          <NotePencil size={18} weight="light" className="mt-0.5 shrink-0 text-primary" />
          <textarea
            id={notesId}
            placeholder="Ej. Pasajes y estadía"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            rows={2}
            className="min-w-0 flex-1 resize-none border-0 bg-transparent p-0 type-body text-text-primary outline-none placeholder:text-text-muted focus:ring-0 focus-visible:outline-none"
          />
        </div>
      </section>
    </TaskSurface>
  )
}