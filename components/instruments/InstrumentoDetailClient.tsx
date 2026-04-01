'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TrendUp, PencilSimple, CaretLeft, Clock } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import { formatAmount, formatCompact, formatDate } from '@/lib/format'
import type { Account, Instrument } from '@/types/database'

// ─── helpers ─────────────────────────────────────────────────────────────────

function dailyYield(i: Instrument): number {
  if (!i.rate) return 0
  return i.type === 'plazo_fijo'
    ? i.amount * (i.rate / 100 / 365)
    : i.amount * (i.rate / 100 / 30)
}

function accumulatedSinceOpen(i: Instrument, today: string): number {
  const d = dailyYield(i)
  if (d === 0) return 0
  const opened    = new Date(`${i.opened_at}T12:00:00-03:00`)
  const todayDate = new Date(`${today}T12:00:00-03:00`)
  const days = Math.max(0, Math.floor((todayDate.getTime() - opened.getTime()) / 86_400_000))
  return d * days
}

function totalAtMaturity(i: Instrument): number | null {
  if (!i.due_date || !i.rate) return null
  const opened = new Date(`${i.opened_at}T12:00:00-03:00`)
  const due    = new Date(`${i.due_date}T12:00:00-03:00`)
  const days   = Math.max(0, Math.ceil((due.getTime() - opened.getTime()) / 86_400_000))
  return i.amount + i.amount * (i.rate / 100 / 365) * days
}

function daysRemaining(dueDate: string, today: string): number {
  const due = new Date(`${dueDate}T12:00:00-03:00`)
  const t   = new Date(`${today}T12:00:00-03:00`)
  return Math.ceil((due.getTime() - t.getTime()) / 86_400_000)
}

function defaultRenovarDueDate(i: Instrument, today: string): string {
  if (!i.due_date) return ''
  const opened = new Date(`${i.opened_at}T12:00:00-03:00`)
  const due    = new Date(`${i.due_date}T12:00:00-03:00`)
  const duration = Math.ceil((due.getTime() - opened.getTime()) / 86_400_000)
  const newDue = new Date(new Date(`${today}T12:00:00-03:00`).getTime() + duration * 86_400_000)
  return newDue.toLocaleDateString('en-CA', { timeZone: 'America/Buenos_Aires' })
}

// ─── sub-components ───────────────────────────────────────────────────────────

function DataRow({
  label,
  value,
  urgent,
  green,
}: {
  label: string
  value: string
  urgent?: boolean
  green?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border-subtle last:border-0">
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">{label}</p>
      <p className={`text-sm font-medium ${urgent ? 'text-danger' : green ? 'text-success' : 'text-text-primary'}`}>
        {value}
      </p>
    </div>
  )
}

// ─── scroll helper ────────────────────────────────────────────────────────────

function scrollOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  setTimeout(() => e.target.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 300)
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  instrument: Instrument
  accounts: Account[]
  today: string
}

type Sheet = null | 'vencimiento' | 'rescate' | 'renovar' | 'editar'

export function InstrumentoDetailClient({ instrument, accounts, today }: Props) {
  const router  = useRouter()
  const [sheet, setSheet] = useState<Sheet>(null)
  const [isSaving, setIsSaving] = useState(false)

  // ── computed ─────────────────────────────────────────────────────────────
  const accumulated = accumulatedSinceOpen(instrument, today)
  const daily       = dailyYield(instrument)
  const maturity    = totalAtMaturity(instrument)
  const days        = instrument.due_date ? daysRemaining(instrument.due_date, today) : null
  const isUrgent    = days !== null && days <= 5
  const account     = accounts.find((a) => a.id === instrument.account_id)
  const typeLabel   = instrument.type === 'plazo_fijo' ? 'Plazo fijo' : 'FCI'
  const isActive    = instrument.status === 'active'
  const currency    = instrument.currency as 'ARS' | 'USD'

  // ── form state ───────────────────────────────────────────────────────────
  const [closeAmount, setCloseAmount] = useState('')
  const [renovarAmount, setRenovarAmount] = useState('')
  const [renovarRate, setRenovarRate]     = useState('')
  const [renovarDueDate, setRenovarDueDate] = useState('')
  const [editLabel, setEditLabel]   = useState('')
  const [editRate, setEditRate]     = useState('')
  const [editDueDate, setEditDueDate] = useState('')

  const openSheet = (s: Sheet) => {
    if (s === 'vencimiento') setCloseAmount(String(Math.round(instrument.amount + accumulated)))
    if (s === 'rescate')     setCloseAmount('')
    if (s === 'renovar') {
      setRenovarAmount(String(Math.round(instrument.amount + accumulated)))
      setRenovarRate(String(instrument.rate ?? ''))
      setRenovarDueDate(defaultRenovarDueDate(instrument, today))
    }
    if (s === 'editar') {
      setEditLabel(instrument.label ?? '')
      setEditRate(String(instrument.rate ?? ''))
      setEditDueDate(instrument.due_date ?? '')
    }
    setSheet(s)
  }

  // ── action handlers ──────────────────────────────────────────────────────
  const handleClose = async (mode: 'vencimiento' | 'rescate') => {
    const amount = parseFloat(closeAmount)
    if (!amount || amount <= 0) return
    setIsSaving(true)
    try {
      const description =
        mode === 'vencimiento'
          ? `Vencimiento ${typeLabel}${instrument.label ? ' — ' + instrument.label : ''}`
          : `Rescate anticipado ${typeLabel}${instrument.label ? ' — ' + instrument.label : ''}`
      const res = await fetch(`/api/instruments/${instrument.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', closed_amount: amount, income_description: description }),
      })
      if (!res.ok) throw new Error()
      router.push('/instrumentos')
    } catch {
      alert('Error al registrar. Intentá de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRenovar = async () => {
    const newAmount = parseFloat(renovarAmount)
    if (!newAmount || newAmount <= 0) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/instruments/${instrument.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'renovar',
          closed_amount: instrument.amount + accumulated,
          new_amount: newAmount,
          rate: renovarRate ? parseFloat(renovarRate) : null,
          due_date: renovarDueDate || null,
          opened_at: today,
        }),
      })
      if (!res.ok) throw new Error()
      const result = await res.json()
      router.push(`/instrumentos/${result.new_instrument.id}`)
    } catch {
      alert('Error al renovar. Intentá de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/instruments/${instrument.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'edit',
          label: editLabel.trim() || null,
          rate: editRate ? parseFloat(editRate) : null,
          due_date: editDueDate || null,
        }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
      setSheet(null)
    } catch {
      alert('Error al guardar cambios. Intentá de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── hero card styling ────────────────────────────────────────────────────
  const heroBg     = instrument.type === 'plazo_fijo' ? 'rgba(184,74,18,0.06)'  : 'rgba(33,120,168,0.06)'
  const heroBorder = instrument.type === 'plazo_fijo' ? 'rgba(184,74,18,0.20)'  : 'rgba(33,120,168,0.20)'
  const iconBg     = instrument.type === 'plazo_fijo' ? 'rgba(184,74,18,0.15)'  : 'rgba(33,120,168,0.12)'
  const iconClass  = instrument.type === 'plazo_fijo' ? 'text-warning' : 'text-primary'

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="mx-auto max-w-md px-4 pb-tab-bar pt-safe">

        {/* Header */}
        <div className="mb-5 flex items-center gap-3 pt-5">
          <Link
            href="/instrumentos"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary/5"
            aria-label="Volver"
          >
            <CaretLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-text-primary truncate">
              {instrument.label || typeLabel}
            </h1>
            {account && (
              <p className="text-xs text-text-tertiary">{account.name}</p>
            )}
          </div>
          {isActive && (
            <button
              onClick={() => openSheet('editar')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary/5"
              aria-label="Editar"
            >
              <PencilSimple size={18} />
            </button>
          )}
        </div>

        {/* Hero card */}
        <div
          className="mb-4 rounded-card px-5 py-5"
          style={{ backgroundColor: heroBg, border: `1px solid ${heroBorder}` }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: iconBg }}
            >
              <TrendUp weight="duotone" size={20} className={iconClass} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-label">
                {typeLabel}
              </p>
              {!isActive && (
                <span className="text-[10px] font-semibold text-text-disabled uppercase tracking-wide">
                  Cerrado
                </span>
              )}
            </div>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-label mb-0.5">
            Monto original
          </p>
          <p className="text-3xl font-bold text-text-primary tabular-nums">
            {formatAmount(instrument.amount, currency)}
          </p>

          {accumulated > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-label">
                Rendimiento acumulado
              </p>
              <p className="text-base font-bold text-success tabular-nums">
                +{formatAmount(accumulated, currency)}
              </p>
            </div>
          )}

          {maturity && (
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-label">
                Total al vencimiento
              </p>
              <p className="text-base font-semibold text-text-primary tabular-nums">
                {formatAmount(maturity, currency)}
              </p>
            </div>
          )}
        </div>

        {/* Data rows */}
        <div className="mb-5 rounded-card bg-bg-secondary px-4">
          {instrument.rate != null && (
            <DataRow
              label="Tasa"
              value={instrument.type === 'plazo_fijo' ? `${instrument.rate}% TNA` : `${instrument.rate}% mensual`}
            />
          )}
          {instrument.due_date && (
            <DataRow
              label="Vencimiento"
              value={`${formatDate(instrument.due_date)}${days !== null ? ` · ${days}d` : ''}`}
              urgent={isUrgent}
            />
          )}
          {account && (
            <DataRow label="Cuenta origen" value={account.name} />
          )}
          {daily > 0 && (
            <DataRow
              label="Rinde por día"
              value={`+${formatCompact(daily, currency)}/día`}
              green
            />
          )}
          <DataRow label="Abierto el" value={formatDate(instrument.opened_at)} />
        </div>

        {/* Actions — only for active instruments */}
        {isActive && (
          <div className="space-y-3">
            {/* Primary */}
            <button
              onClick={() => openSheet('vencimiento')}
              className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white transition-transform active:scale-95 hover:scale-[1.02]"
            >
              {instrument.type === 'plazo_fijo' ? 'Registrar vencimiento ✓' : 'Registrar rescate ✓'}
            </button>

            {/* Secondary */}
            <div className="flex gap-2">
              {instrument.type === 'plazo_fijo' && (
                <button
                  onClick={() => openSheet('renovar')}
                  className="flex-1 rounded-button border border-border-ocean bg-bg-secondary py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/5"
                >
                  Renovar
                </button>
              )}
              <button
                onClick={() => openSheet('rescate')}
                className="flex-1 rounded-button border border-border-ocean bg-bg-secondary py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary/5"
              >
                Rescate anticipado
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Vencimiento / Rescate sheet ─────────────────────────────────────── */}
      {(sheet === 'vencimiento' || sheet === 'rescate') && (
        <Modal open onClose={() => setSheet(null)}>
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
          <h2 className="text-lg font-semibold text-text-primary">
            {sheet === 'vencimiento' ? 'Registrar vencimiento' : 'Rescate anticipado'}
          </h2>
          {sheet === 'rescate' && (
            <p className="mt-1 text-xs text-text-tertiary">
              Ingresá el monto real acreditado — el banco puede aplicar penalidad al rescate anticipado
            </p>
          )}

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                {sheet === 'vencimiento' ? 'Capital + intereses estimados' : 'Monto real acreditado'}
              </label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={closeAmount}
                onChange={(e) => setCloseAmount(e.target.value)}
                onFocus={scrollOnFocus}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => handleClose(sheet)}
              disabled={!closeAmount || Number(closeAmount) <= 0 || isSaving}
              className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white transition-transform active:scale-95 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Confirmar ingreso ✓'}
            </button>
            <button
              onClick={() => setSheet(null)}
              disabled={isSaving}
              className="w-full rounded-button py-3 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {/* ── Renovar sheet ────────────────────────────────────────────────────── */}
      {sheet === 'renovar' && (
        <Modal open onClose={() => setSheet(null)}>
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
          <h2 className="text-lg font-semibold text-text-primary">Renovar plazo fijo</h2>
          <p className="mt-1 mb-5 text-xs text-text-tertiary">
            Revisá los parámetros del nuevo instrumento
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Nuevo monto (capital + intereses)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={renovarAmount}
                onChange={(e) => setRenovarAmount(e.target.value)}
                onFocus={scrollOnFocus}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Tasa TNA %
              </label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="Ej. 78"
                value={renovarRate}
                onChange={(e) => setRenovarRate(e.target.value)}
                onFocus={scrollOnFocus}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Nuevo vencimiento
              </label>
              <input
                type="date"
                value={renovarDueDate}
                onChange={(e) => setRenovarDueDate(e.target.value)}
                onFocus={scrollOnFocus}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleRenovar}
              disabled={!renovarAmount || Number(renovarAmount) <= 0 || isSaving}
              className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white transition-transform active:scale-95 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Renovando...' : 'Renovar instrumento ✓'}
            </button>
            <button
              onClick={() => setSheet(null)}
              disabled={isSaving}
              className="w-full rounded-button py-3 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {/* ── Editar sheet ─────────────────────────────────────────────────────── */}
      {sheet === 'editar' && (
        <Modal open onClose={() => setSheet(null)}>
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
          <h2 className="text-lg font-semibold text-text-primary">Editar instrumento</h2>
          <p className="mt-1 mb-5 text-xs text-text-tertiary">
            No se puede modificar monto ni cuenta origen
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                Descripción <span className="normal-case text-text-disabled">(opcional)</span>
              </label>
              <input
                type="text"
                placeholder="Ej. BNA 30 días"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                onFocus={scrollOnFocus}
                maxLength={100}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                {instrument.type === 'plazo_fijo' ? 'Tasa TNA %' : 'Rendimiento estimado %'}
              </label>
              <input
                type="number"
                inputMode="decimal"
                placeholder="Ej. 78"
                value={editRate}
                onChange={(e) => setEditRate(e.target.value)}
                onFocus={scrollOnFocus}
                className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
              />
            </div>

            {instrument.type === 'plazo_fijo' && (
              <div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-text-secondary">
                  Vencimiento
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  onFocus={scrollOnFocus}
                  className="w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={handleEdit}
              disabled={isSaving}
              className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-white transition-transform active:scale-95 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Guardar cambios ✓'}
            </button>
            <button
              onClick={() => setSheet(null)}
              disabled={isSaving}
              className="w-full rounded-button py-3 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
