'use client'

import { ArrowDown, ArrowUp, ArrowsLeftRight, CaretRight, Minus } from '@phosphor-icons/react'
import { formatAmount } from '@/lib/format'
import type { Metrics } from '@/lib/analytics/computeMetrics'

interface CardProps {
  metrics: Metrics
  onClick: () => void
}

function getStatusCopy(status: Metrics['monthStatus']['status']): string {
  switch (status) {
    case 'positive':
      return 'Ahorraste este mes'
    case 'negative':
      return 'Salió más de lo que entró'
    case 'neutral':
      return 'Mes equilibrado'
    case 'no_income':
    default:
      return 'Cargá tu ingreso para ver el neto'
  }
}

function getStatusColor(status: Metrics['monthStatus']['status']): string {
  switch (status) {
    case 'positive':
      return 'text-success'
    case 'negative':
      return 'text-danger'
    case 'neutral':
      return 'text-text-primary'
    case 'no_income':
    default:
      return 'text-text-secondary'
  }
}

function getStatusIcon(status: Metrics['monthStatus']['status']) {
  switch (status) {
    case 'positive':
      return <ArrowUp weight="bold" size={16} className="text-success" />
    case 'negative':
      return <ArrowDown weight="bold" size={16} className="text-danger" />
    case 'neutral':
      return <Minus weight="bold" size={16} className="text-text-secondary" />
    case 'no_income':
    default:
      return <ArrowsLeftRight weight="bold" size={16} className="text-text-secondary" />
  }
}

function formatSignedAmount(amount: number, currency: 'ARS' | 'USD'): string {
  if (amount > 0) return `+${formatAmount(amount, currency)}`
  if (amount < 0) return `-${formatAmount(Math.abs(amount), currency)}`
  return formatAmount(0, currency)
}

function getRatioLabel(metrics: Metrics): string | null {
  const { monthStatus } = metrics

  if (monthStatus.status === 'no_income') return null
  if (monthStatus.status === 'negative' && monthStatus.spentPctOfIncome !== null) {
    return `Gastaste ${monthStatus.spentPctOfIncome}% de tu ingreso`
  }
  if (monthStatus.savingsRate !== null) {
    return `${monthStatus.savingsRate}% de ahorro`
  }
  return null
}

export function EstadoMesCard({ metrics, onClick }: CardProps) {
  const { currency, monthStatus } = metrics
  const amountColor = getStatusColor(monthStatus.status)
  const subtitle = getStatusCopy(monthStatus.status)

  return (
    <button
      onClick={onClick}
      className="card-s5 w-full p-4 text-left transition-opacity hover:opacity-90"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            {getStatusIcon(monthStatus.status)}
          </div>
          <span className="type-label text-primary">Estado del mes</span>
        </div>
        <CaretRight weight="bold" size={14} className="text-primary" />
      </div>

      {monthStatus.status === 'no_income' ? (
        <>
          <p className="mb-0.5 text-[22px] font-extrabold tracking-[-0.02em] text-text-primary">
            {formatAmount(monthStatus.expenses, currency)}
          </p>
          <p className="mb-3 text-[12px] text-text-dim">{subtitle}</p>
          <p className="type-meta text-text-dim">
            Salió{' '}
            <span className="font-semibold text-text-primary">
              {formatAmount(monthStatus.expenses, currency)}
            </span>
          </p>
        </>
      ) : (
        <>
          <p className={`mb-0.5 text-[22px] font-extrabold tracking-[-0.02em] ${amountColor}`}>
            {formatSignedAmount(monthStatus.net ?? 0, currency)}
          </p>
          <p className="mb-3 text-[12px] text-text-dim">{subtitle}</p>
          <p className="type-meta text-text-dim">
            Entró{' '}
            <span className="font-semibold text-text-primary">
              {formatAmount(monthStatus.income ?? 0, currency)}
            </span>
            {' · '}
            Salió{' '}
            <span className="font-semibold text-text-primary">
              {formatAmount(monthStatus.expenses, currency)}
            </span>
          </p>
        </>
      )}
    </button>
  )
}

export function DrillEstadoMes({ metrics }: { metrics: Metrics }) {
  const { currency, monthStatus } = metrics
  const amountColor = getStatusColor(monthStatus.status)
  const subtitle = getStatusCopy(monthStatus.status)
  const ratioLabel = getRatioLabel(metrics)

  return (
    <div className="space-y-4 px-5 pb-4">
      <div className="card-s5 p-6">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          {getStatusIcon(monthStatus.status)}
        </div>

        {monthStatus.status === 'no_income' ? (
          <>
            <p className="text-[13px] font-semibold text-text-secondary">{subtitle}</p>
            <p className="mt-2 text-[32px] font-extrabold leading-tight text-text-primary">
              {formatAmount(monthStatus.expenses, currency)}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">Salió en el mes</p>
          </>
        ) : (
          <>
            <p className="text-[13px] font-semibold text-text-secondary">{subtitle}</p>
            <p className={`mt-2 text-[32px] font-extrabold leading-tight ${amountColor}`}>
              {formatSignedAmount(monthStatus.net ?? 0, currency)}
            </p>
            {ratioLabel ? <p className="mt-1 text-xs text-text-tertiary">{ratioLabel}</p> : null}
          </>
        )}

        <div className="mt-5 space-y-3 border-t border-border-ocean pt-4">
          <div className="flex items-center justify-between">
            <span className="type-body text-text-secondary">Entró</span>
            <span className="type-body font-bold tabular-nums text-text-primary">
              {monthStatus.income !== null ? formatAmount(monthStatus.income, currency) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="type-body text-text-secondary">Salió</span>
            <span className="type-body font-bold tabular-nums text-text-primary">
              {formatAmount(monthStatus.expenses, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="type-body text-text-secondary">Neto</span>
            <span className={`type-body font-bold tabular-nums ${amountColor}`}>
              {monthStatus.net !== null ? formatSignedAmount(monthStatus.net, currency) : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
