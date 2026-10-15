'use client'

import { useState } from 'react'
import { buildCardLastFourPayload, validateCardLastFour } from '@/lib/shared-receipts-ui'
import type { StatementAnswer } from '@/lib/card-setup-state'
import styles from '@/components/onboarding/landing-flow.module.css'

export type CardSetupSubmit = {
  name: string
  closing_day: number | null
  due_day: number | null
  account_id: string | null
  last_four: string | null
  statement_answer: StatementAnswer | null
}

type AccountOption = { id: string; name: string }

type Props = {
  accounts: AccountOption[]
  defaultAccountId?: string | null
  initial?: {
    name?: string
    closing_day?: number | null
    due_day?: number | null
    account_id?: string | null
    last_four?: string | null
    statement_answer?: StatementAnswer | null
  } | null
  requireAnswer?: boolean
  submitLabel: string
  variant?: 'landing' | 'app'
  onSubmit: (value: CardSetupSubmit) => Promise<void>
}

const ANSWERS: Array<{ value: StatementAnswer; label: string }> = [
  { value: 'yes', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'unknown', label: 'No sé todavía' },
]

function dayValue(value: string): number | null {
  if (!value.trim()) return null
  const day = Number(value)
  if (!Number.isInteger(day) || day < 1 || day > 31) return null
  return day
}

export function CardSetupForm({
  accounts,
  defaultAccountId = null,
  initial,
  requireAnswer = true,
  submitLabel,
  variant = 'landing',
  onSubmit,
}: Props) {
  const initialDatesUnknown = Boolean(initial && initial.closing_day == null && initial.due_day == null && initial.name)
  const [name, setName] = useState(initial?.name ?? '')
  const [closing, setClosing] = useState(initial?.closing_day ? String(initial.closing_day) : '')
  const [due, setDue] = useState(initial?.due_day ? String(initial.due_day) : '')
  const [datesUnknown, setDatesUnknown] = useState(initialDatesUnknown)
  const [accountId, setAccountId] = useState(initial?.account_id ?? defaultAccountId ?? accounts[0]?.id ?? '')
  const [lastFour, setLastFour] = useState(initial?.last_four ?? '')
  const [answer, setAnswer] = useState<StatementAnswer | null>(initial?.statement_answer ?? null)
  const [more, setMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const accountName = accounts.find((account) => account.id === accountId)?.name ?? 'Sin cuenta'
  const app = variant === 'app'

  async function save() {
    if (saving) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Poné el nombre de la tarjeta.')
      return
    }
    if (requireAnswer && !answer) {
      setError('Elegí si tenés un resumen cerrado sin pagar.')
      return
    }
    const closingDay = datesUnknown ? null : dayValue(closing)
    const dueDay = datesUnknown ? null : dayValue(due)
    if (!datesUnknown && (closingDay == null || dueDay == null)) {
      setError('Completá el día de cierre y el de vencimiento, o elegí «No las sé».')
      return
    }
    const lastFourResult = validateCardLastFour(lastFour)
    if (!lastFourResult.valid) {
      setError(lastFourResult.message)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        name: trimmed,
        closing_day: closingDay,
        due_day: dueDay,
        account_id: accountId || null,
        last_four: buildCardLastFourPayload(lastFour).last_four ?? null,
        statement_answer: answer,
      })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No pudimos guardar la tarjeta.')
      setSaving(false)
    }
  }

  const answerButtons = (
    <div className={app ? 'mt-2 flex flex-wrap gap-2' : styles.chips}>
      {ANSWERS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={answer === option.value}
          className={
            app
              ? `rounded-full border px-3 py-2 text-sm font-semibold ${answer === option.value ? 'border-primary bg-primary text-white' : 'border-border-strong bg-white text-text-primary'}`
              : `${styles.chip} ${answer === option.value ? styles.chipOn : ''}`
          }
          onClick={() => setAnswer(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )

  return (
    <div>
      <label className={app ? 'block' : styles.field}>
        <span className={app ? 'mb-1 block text-xs font-semibold text-text-secondary' : styles.label}>Nombre</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={app ? 'w-full border-0 border-b border-border-strong bg-transparent px-0 py-2 text-base font-semibold text-text-primary outline-none' : `${styles.amount} ${styles.dayInput}`}
          autoComplete="off"
        />
      </label>
      <div className={app ? 'mt-4' : styles.field}>
        <div className={styles.dayGrid}>
          <label>
            <span className={app ? 'mb-1 block text-xs font-semibold text-text-secondary' : styles.label}>Cierre habitual</span>
            <span className={app ? 'flex items-center gap-2 rounded-input border border-border-strong px-3 py-2' : `${styles.amount} ${styles.dayInput}`}>
              <span className={app ? 'text-sm text-text-tertiary' : styles.amountPrefix}>Día</span>
              <input
                inputMode="numeric"
                value={datesUnknown ? '' : closing}
                disabled={datesUnknown}
                placeholder="1 a 31"
                onChange={(event) => {
                  setDatesUnknown(false)
                  setClosing(event.target.value.replace(/\D/g, '').slice(0, 2))
                }}
                className="w-full min-w-0 border-0 bg-transparent text-base outline-none"
              />
            </span>
          </label>
          <label>
            <span className={app ? 'mb-1 block text-xs font-semibold text-text-secondary' : styles.label}>Vencimiento habitual</span>
            <span className={app ? 'flex items-center gap-2 rounded-input border border-border-strong px-3 py-2' : `${styles.amount} ${styles.dayInput}`}>
              <span className={app ? 'text-sm text-text-tertiary' : styles.amountPrefix}>Día</span>
              <input
                inputMode="numeric"
                value={datesUnknown ? '' : due}
                disabled={datesUnknown}
                placeholder="1 a 31"
                onChange={(event) => {
                  setDatesUnknown(false)
                  setDue(event.target.value.replace(/\D/g, '').slice(0, 2))
                }}
                className="w-full min-w-0 border-0 bg-transparent text-base outline-none"
              />
            </span>
          </label>
        </div>
        <button
          type="button"
          className={app ? 'mt-2 text-sm font-semibold text-primary' : `${styles.linkButton} mt-2`}
          onClick={() => {
            setDatesUnknown(true)
            setClosing('')
            setDue('')
          }}
        >
          No las sé, completar después
        </button>
      </div>
      <p className={app ? 'mt-4 text-sm text-text-secondary' : 'mt-3.5 text-[13px] text-[#536770]'}>
        Se paga desde <b className={app ? 'font-semibold text-text-primary' : 'font-semibold text-[#152F3B]'}>{accountName}</b>
        {' · '}
        <button type="button" className={app ? 'font-semibold text-primary' : styles.linkButton} onClick={() => setMore(true)}>
          Más datos
        </button>
      </p>
      {more ? (
        <div className={app ? 'mt-3 space-y-3' : styles.more}>
          <label>
            <span className={app ? 'mb-1 block text-xs font-semibold text-text-secondary' : styles.label}>Últimos 4</span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={lastFour}
              onChange={(event) => setLastFour(event.target.value.replace(/\D/g, '').slice(0, 4))}
              className={app ? 'w-full rounded-input border border-border-strong px-3 py-2 text-sm' : `${styles.amount} ${styles.dayInput}`}
            />
          </label>
          <label>
            <span className={app ? 'mb-1 block text-xs font-semibold text-text-secondary' : styles.label}>Cuenta de pago</span>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className={app ? 'w-full rounded-input border border-border-strong bg-white px-3 py-2 text-sm' : `${styles.amount} ${styles.dayInput}`}
            >
              <option value="">Sin cuenta</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </label>
          <p className="text-[13px] text-[#536770]">Es la cuenta desde la que solés pagarla. Gota no conecta el banco ni activa débitos.</p>
        </div>
      ) : null}
      <div className={app ? 'mt-4' : styles.field}>
        <p className={app ? 'text-sm font-semibold text-text-primary' : styles.question}>¿Tenés un resumen cerrado pendiente de pagar?</p>
        {answerButtons}
      </div>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <div className={styles.footer}>
        <button type="button" className={app ? 'w-full rounded-button bg-primary py-3 text-sm font-semibold text-white disabled:opacity-50' : styles.cta} disabled={saving} onClick={() => void save()}>
          {saving ? 'Guardando…' : submitLabel} {!app && !saving ? <b>→</b> : null}
        </button>
      </div>
    </div>
  )
}
