'use client'
import { useState } from 'react'
import { formatDate } from '@/lib/format'
import type { Draft } from '@/lib/reconciliation/domain'
import { formatArDecimal, parseArSignedDecimalInput } from '@/lib/ar-input'
import { CATEGORIES } from '@/lib/validation/schemas'

export function MovementDraftSteps({
  draft,
  busy,
  checkpointDay,
  adjusted,
  onChange,
  onSave,
  onConfirm,
}: {
  draft: Draft
  busy: boolean
  checkpointDay: string
  adjusted: boolean
  onChange: (change: Partial<Draft>) => void
  onSave: () => Promise<boolean>
  onConfirm: (included: boolean, sameDayBefore: boolean) => Promise<boolean>
}) {
  const income = draft.kind === 'income'
  const categories = income
    ? [
        { value: 'salary', label: 'Sueldo' },
        { value: 'freelance', label: 'Trabajo independiente' },
        { value: 'other', label: 'Otro ingreso' },
      ]
    : CATEGORIES.filter((c) => c !== 'Pago de Tarjetas').map((c) => ({
        value: c,
        label: c,
      }))
  const [step, setStep] = useState(() =>
    !draft.amount
      ? 0
      : !draft.description
        ? 1
        : !draft.date
          ? 2
          : !draft.category
            ? 3
            : 4
  )
  const [included, setIncluded] = useState(false)
  const [before, setBefore] = useState(false)
  const valid = [
    Boolean(draft.amount && Number(draft.amount) >= 1),
    Boolean(draft.description.trim()),
    Boolean(draft.date),
    Boolean(draft.category),
    included && (draft.date !== checkpointDay || before),
  ][step]
  const inputClass =
    'mt-3 min-h-12 w-full rounded-input border border-border-strong bg-bg-primary px-4 text-base text-text-primary'
  const titles = [
    '¿Cuánto fue?',
    income ? '¿Qué ingreso encontraste?' : '¿Qué gasto encontraste?',
    '¿Cuándo ocurrió?',
    '¿En qué categoría va?',
    '¿Ya estaba en el saldo que confirmaste?',
  ]
  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault()
        if (step < 4) {
          if (await onSave()) setStep(step + 1)
        } else await onConfirm(included, before)
      }}
    >
      <h2 className="type-body-lg">{titles[step]}</h2>
      {step === 0 && (
        <label className="block">
          <span className="sr-only">Importe</span>
          <input
            autoFocus
            inputMode="decimal"
            value={formatArDecimal(draft.amount)}
            onChange={(event) =>
              onChange({
                amount: parseArSignedDecimalInput(event.target.value),
              })
            }
            className={inputClass}
          />
        </label>
      )}
      {step === 1 && (
        <label className="block">
          <span className="sr-only">Descripción</span>
          <input
            autoFocus
            maxLength={100}
            value={draft.description}
            onChange={(event) => onChange({ description: event.target.value })}
            className={inputClass}
          />
        </label>
      )}
      {step === 2 && (
        <>
          <label className="block">
            <span className="sr-only">Fecha del movimiento</span>
            <input
              autoFocus
              type="date"
              value={draft.date}
              onChange={(event) => onChange({ date: event.target.value })}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSave()}
            className="text-primary min-h-11 text-sm"
          >
            No recuerdo el día · guardar borrador
          </button>
        </>
      )}
      {step === 3 && (
        <label className="block">
          <span className="sr-only">Categoría</span>
          <select
            autoFocus
            value={draft.category}
            onChange={(event) => onChange({ category: event.target.value })}
            className={inputClass}
          >
            <option value="">Elegir categoría</option>
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {step === 4 && (
        <>
          <p className="text-text-secondary text-sm">
            {draft.description} · {formatArDecimal(draft.amount)} ·{' '}
            {formatDate(draft.date)}
          </p>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={included}
              onChange={(event) => setIncluded(event.target.checked)}
            />
            Sí, ya estaba incluido
          </label>
          {draft.date === checkpointDay && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={before}
                onChange={(event) => setBefore(event.target.checked)}
              />
              Ocurrió antes de confirmar el saldo
            </label>
          )}
          <p className="type-meta text-text-secondary">
            {adjusted
              ? 'Reemplaza parte del ajuste. Tu saldo actual no cambia.'
              : income
                ? 'Se registra el ingreso real.'
                : 'Se registra el gasto real.'}
          </p>
        </>
      )}
      <button
        type="submit"
        disabled={busy || !valid}
        className="rounded-button bg-primary min-h-12 w-full text-sm font-bold text-white disabled:opacity-50"
      >
        {step < 4 ? 'Continuar' : 'Confirmar movimiento'}
      </button>
      {step > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setStep(step - 1)}
          className="text-primary min-h-11 w-full text-sm"
        >
          Volver
        </button>
      )}
    </form>
  )
}
