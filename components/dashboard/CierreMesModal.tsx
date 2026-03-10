'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatAmount } from '@/lib/format'
import { buildPerAccountBalances } from '@/lib/rollover'
import type { PrevMonthSummary } from '@/lib/rollover'
import type { Account, Currency } from '@/types/database'

interface Props {
  summary: PrevMonthSummary
  toMonth: string // YYYY-MM
  currency: Currency
  accounts: Account[]
}

function getMonthLabel(ym: string): string {
  const label = new Date(ym + '-15').toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function CierreMesModal({ summary, toMonth, currency, accounts }: Props) {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [editValue, setEditValue] = useState(String(summary.saldoFinal))
  const [confirmZero, setConfirmZero] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const fmt = (n: number) => formatAmount(n, currency)

  const executeRollover = async (saldoInicial: number) => {
    setIsSaving(true)
    try {
      const toMonthDate = toMonth + '-01'
      const fromMonthDate = summary.prevMonth + '-01'

      const perAccountBalances = buildPerAccountBalances(saldoInicial, accounts, currency)

      await Promise.all([
        // Create account_period_balance for each account
        ...perAccountBalances.map((bal) =>
          fetch('/api/account-balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              account_id: bal.account_id,
              period: toMonthDate,
              balance_ars: bal.balance_ars,
              balance_usd: bal.balance_usd,
              source: 'rollover_auto',
            }),
          }),
        ),
        // Close previous month (backward compat)
        fetch('/api/monthly-income', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month: fromMonthDate }),
        }),
      ])

      router.refresh()
    } catch {
      alert('Error al ejecutar el rollover. Intentá de nuevo.')
      setIsSaving(false)
    }
  }

  const Row = ({ label, value, sub }: { label: string; value: string; sub?: boolean }) => (
    <div className={`flex justify-between ${sub ? 'pl-4' : ''}`}>
      <span className={`text-xs text-text-tertiary ${sub ? 'text-text-disabled' : ''}`}>
        {sub ? '└ ' : ''}
        {label}
      </span>
      <span
        className={`text-sm font-medium text-text-primary ${sub ? 'text-xs text-text-tertiary' : ''}`}
      >
        {value}
      </span>
    </div>
  )

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-[28px] bg-bg-secondary border-t border-border-subtle px-5 pb-10 pt-5 slide-up">
        {/* Handle */}
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled" />

        <h2 className="mb-1 text-lg font-semibold text-text-primary">
          Cierre de {getMonthLabel(summary.prevMonth)}
        </h2>
        <p className="mb-5 text-xs text-text-tertiary">
          Revisá el resumen antes de arrancar {getMonthLabel(toMonth)}.
        </p>

        {/* Summary */}
        <div className="mb-5 space-y-2 rounded-card bg-bg-tertiary px-4 py-3">
          <Row label="Saldo final" value={fmt(summary.saldoFinal)} />
          <div className="h-px bg-border-subtle" />
          <Row label="Ingresos" value={fmt(summary.ingresos)} />
          <Row label="Total gastado" value={fmt(summary.gastosMes + summary.pagosTarjeta)} />
          <Row label="Gastos directos" value={fmt(summary.gastosMes)} sub />
          <Row label="Pagos de tarjeta" value={fmt(summary.pagosTarjeta)} sub />
        </div>

        <div className="mb-5 h-px bg-border-subtle" />

        <p className="mb-1 text-sm text-text-primary">¿Trasladamos el saldo final al nuevo mes?</p>

        {editMode ? (
          <div className="mb-4">
            <div className="flex items-center rounded-full border border-primary/40 bg-bg-tertiary px-4 py-3 mb-3">
              <span className="mr-2 text-sm text-text-tertiary">$</span>
              <input
                type="number"
                inputMode="numeric"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                autoFocus
                className="flex-1 bg-transparent text-sm text-text-primary outline-none"
              />
            </div>
            <button
              onClick={() => executeRollover(Math.max(0, Number(editValue) || 0))}
              disabled={isSaving}
              className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-bg-primary transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Confirmar'}
            </button>
          </div>
        ) : (
          <p className="mb-4 text-2xl font-light text-primary">{fmt(summary.saldoFinal)}</p>
        )}

        {!editMode && (
          <div className="space-y-2">
            <button
              onClick={() => executeRollover(summary.saldoFinal)}
              disabled={isSaving}
              className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-bg-primary transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : `Sí, trasladar ${fmt(summary.saldoFinal)}`}
            </button>
            <button
              onClick={() => setEditMode(true)}
              disabled={isSaving}
              className="w-full rounded-full border border-primary/30 py-3.5 text-sm font-medium text-primary transition-all active:scale-95"
            >
              Editar monto
            </button>

            {confirmZero ? (
              <div className="rounded-card border border-border-subtle bg-bg-tertiary px-4 py-3">
                <p className="mb-3 text-xs text-text-secondary">
                  ¿Seguro? El saldo de {getMonthLabel(summary.prevMonth)} no se trasladará.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => executeRollover(0)}
                    disabled={isSaving}
                    className="flex-1 rounded-full bg-danger/20 py-2.5 text-sm font-medium text-danger"
                  >
                    Sí, empezar en cero
                  </button>
                  <button
                    onClick={() => setConfirmZero(false)}
                    className="flex-1 rounded-full bg-bg-elevated py-2.5 text-sm text-text-secondary"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmZero(true)}
                disabled={isSaving}
                className="w-full py-2.5 text-sm text-text-tertiary"
              >
                Empezar en cero
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
