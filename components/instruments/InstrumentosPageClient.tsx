'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TrendUp, Clock, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { InstrumentForm } from './InstrumentForm'
import { formatCompact, formatDate } from '@/lib/format'
import type { Account, Instrument } from '@/types/database'

interface Props {
  instruments: Instrument[]
  accounts: Account[]
  today: string       // YYYY-MM-DD
  currentMonth: string // YYYY-MM
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function dailyYield(i: Instrument): number {
  if (!i.rate) return 0
  return i.type === 'plazo_fijo'
    ? i.amount * (i.rate / 100 / 365)
    : i.amount * (i.rate / 100 / 30)
}

function accumulatedThisMonth(i: Instrument, today: string, currentMonth: string): number {
  const d = dailyYield(i)
  if (d === 0) return 0
  const monthStart = new Date(`${currentMonth}-01T12:00:00-03:00`)
  const opened    = new Date(`${i.opened_at}T12:00:00-03:00`)
  const todayDate = new Date(`${today}T12:00:00-03:00`)
  const from = opened > monthStart ? opened : monthStart
  const days = Math.max(0, Math.floor((todayDate.getTime() - from.getTime()) / 86_400_000))
  return d * days
}

function daysRemaining(dueDate: string, today: string): number {
  const due = new Date(`${dueDate}T12:00:00-03:00`)
  const t   = new Date(`${today}T12:00:00-03:00`)
  return Math.ceil((due.getTime() - t.getTime()) / 86_400_000)
}

function sortInstruments(list: Instrument[]): Instrument[] {
  return [...list].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    if (a.due_date) return -1
    if (b.due_date) return 1
    return b.opened_at.localeCompare(a.opened_at)
  })
}

// ─── component ───────────────────────────────────────────────────────────────

export function InstrumentosPageClient({ instruments, accounts, today, currentMonth }: Props) {
  const router  = useRouter()
  const [showForm, setShowForm] = useState(false)

  const sorted   = sortInstruments(instruments)
  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  const totalDailyAll = instruments.reduce((s, i) => s + dailyYield(i), 0)
  const arsTotal      = instruments.filter((i) => i.currency === 'ARS').reduce((s, i) => s + i.amount, 0)
  const usdTotal      = instruments.filter((i) => i.currency === 'USD').reduce((s, i) => s + i.amount, 0)
  const arsMonthYield = instruments
    .filter((i) => i.currency === 'ARS')
    .reduce((s, i) => s + accumulatedThisMonth(i, today, currentMonth), 0)
  const nextDue = sorted.find((i) => i.due_date)

  // ── empty state ─────────────────────────────────────────────────────────────
  if (instruments.length === 0) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <div className="mx-auto max-w-md px-4 pb-tab-bar pt-safe">
          <div className="mb-6 flex items-center gap-3 pt-5">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary/5"
              aria-label="Volver"
            >
              <CaretLeft size={20} />
            </Link>
            <h1 className="text-base font-semibold text-text-primary">Instrumentos</h1>
          </div>

          <div className="rounded-card bg-bg-secondary px-4 py-12 text-center">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(184,74,18,0.12)' }}
            >
              <TrendUp weight="duotone" size={28} className="text-warning" />
            </div>
            <p className="mb-1 text-sm font-semibold text-text-primary">Sin instrumentos activos</p>
            <p className="mb-5 text-xs text-text-tertiary">
              Abrí un plazo fijo o FCI para verlos acá
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="rounded-button bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 hover:scale-[1.02]"
            >
              Agregar instrumento
            </button>
          </div>
        </div>

        {showForm && (
          <InstrumentForm
            accounts={accounts}
            defaultCurrency="ARS"
            onClose={() => {
              setShowForm(false)
              router.refresh()
            }}
          />
        )}
      </div>
    )
  }

  // ── populated state ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-md px-4 pb-tab-bar pt-safe">

        {/* Header */}
        <div className="mb-5 flex items-start gap-3 pt-5">
          <Link
            href="/"
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary/5"
            aria-label="Volver"
          >
            <CaretLeft size={20} />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-text-primary">Instrumentos</h1>
            <p className="text-xs text-text-tertiary">
              {instruments.length} activo{instruments.length !== 1 ? 's' : ''}
              {totalDailyAll > 0 && (
                <> · rinden {formatCompact(totalDailyAll, 'ARS')} hoy</>
              )}
            </p>
          </div>
        </div>

        {/* Summary card */}
        <div
          className="mb-4 rounded-card px-4 py-4 space-y-3"
          style={{
            background: 'rgba(255,255,255,0.50)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.70)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-label">
              Total en instrumentos
            </span>
            <div className="text-right">
              {arsTotal > 0 && (
                <p className="text-sm font-bold text-text-primary tabular-nums">
                  {formatCompact(arsTotal, 'ARS')}
                </p>
              )}
              {usdTotal > 0 && (
                <p className="text-sm font-bold text-text-primary tabular-nums">
                  {formatCompact(usdTotal, 'USD')}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-label">
              Rendido este mes
            </span>
            <p className="text-sm font-semibold text-success tabular-nums">
              {arsMonthYield > 0 ? `+${formatCompact(arsMonthYield, 'ARS')}` : '—'}
            </p>
          </div>

          {nextDue && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-label">
                Próx. vencimiento
              </span>
              <p className="text-sm font-medium text-text-secondary tabular-nums">
                {formatDate(nextDue.due_date!)} · {formatCompact(nextDue.amount, nextDue.currency as 'ARS' | 'USD')}
              </p>
            </div>
          )}
        </div>

        {/* Instrument list */}
        <div className="space-y-2">
          {sorted.map((instrument) => {
            const acc       = instrument.account_id ? accountMap.get(instrument.account_id) : null
            const days      = instrument.due_date ? daysRemaining(instrument.due_date, today) : null
            const isUrgent  = days !== null && days <= 5
            const accumulated = accumulatedThisMonth(instrument, today, currentMonth)
            const typeLabel = instrument.type === 'plazo_fijo' ? 'Plazo fijo' : 'FCI'

            const subtitleParts: string[] = []
            if (acc) subtitleParts.push(acc.name)
            if (instrument.rate) {
              const suffix = instrument.type === 'plazo_fijo' ? '% TNA' : '% mens.'
              subtitleParts.push(`${instrument.rate}${suffix}`)
            }

            return (
              <Link
                key={instrument.id}
                href={`/instrumentos/${instrument.id}`}
                className="flex items-center gap-3 rounded-card bg-bg-secondary px-4 py-3.5 transition-colors active:scale-[0.99]"
                style={{
                  border: isUrgent
                    ? '1px solid rgba(220,38,38,0.30)'
                    : '1px solid transparent',
                }}
              >
                {/* Icon */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isUrgent
                      ? 'rgba(220,38,38,0.12)'
                      : instrument.type === 'plazo_fijo'
                      ? 'rgba(184,74,18,0.15)'
                      : 'rgba(33,120,168,0.12)',
                  }}
                >
                  <TrendUp
                    weight="duotone"
                    size={18}
                    className={
                      isUrgent
                        ? 'text-danger'
                        : instrument.type === 'plazo_fijo'
                        ? 'text-warning'
                        : 'text-primary'
                    }
                  />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {/* Row 1: title + amount */}
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {instrument.label || typeLabel}
                    </p>
                    <p className="shrink-0 text-sm font-bold text-text-primary tabular-nums">
                      {formatCompact(instrument.amount, instrument.currency as 'ARS' | 'USD')}
                    </p>
                  </div>

                  {/* Row 2: subtitle + accumulated */}
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] text-text-tertiary">
                      {subtitleParts.join(' · ')}
                    </p>
                    {accumulated > 0 && (
                      <p className="shrink-0 text-[11px] font-semibold text-success tabular-nums">
                        +{formatCompact(accumulated, instrument.currency as 'ARS' | 'USD')}
                      </p>
                    )}
                  </div>

                  {/* Row 3: due date */}
                  {instrument.due_date && (
                    <div
                      className={`mt-1 flex items-center gap-1 ${
                        isUrgent ? 'text-danger' : 'text-text-disabled'
                      }`}
                    >
                      <Clock size={11} />
                      <p className="text-[10px] font-medium">
                        {formatDate(instrument.due_date)}
                        {days !== null && ` · ${days}d`}
                      </p>
                    </div>
                  )}
                </div>

                <CaretRight size={14} weight="light" className="shrink-0 text-text-disabled" />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
