'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { todayAR } from '@/lib/format'
import type { Account, Card } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  card: Card
  accounts: Account[]
}

export function LegacyCardPaymentModal({ open, onClose, onSuccess, card, accounts }: Props) {
  const [monto, setMonto] = useState('')
  const [accountId, setAccountId] = useState(card.account_id ?? (accounts[0]?.id ?? ''))
  const [fecha, setFecha] = useState(todayAR())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const montoNum = parseFloat(monto.replace(/[^0-9.]/g, '')) || 0
  const canSubmit = montoNum > 0 && !!accountId && !!fecha

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: montoNum,
          currency: 'ARS',
          category: 'Pago de Tarjetas',
          description: `Pago anterior ${card.name}`,
          payment_method: 'DEBIT',
          card_id: card.id,
          account_id: accountId,
          date: fecha,
          is_want: null,
          is_legacy_card_payment: true,
        }),
      })

      if (!res.ok) throw new Error('Error al registrar el pago')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />

      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
          Pago anterior a Gota
        </p>
        <h2 className="mt-0.5 text-base font-bold text-text-primary">{card.name}</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Registralo si este pago cancela deuda de tarjeta que existia antes de empezar a usar Gota.
        </p>
      </div>

      <div className="space-y-5 pb-24">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            Monto pagado
          </p>
          <div className="flex items-center gap-2 rounded-[18px] bg-bg-secondary px-4 py-3.5">
            <span className="text-sm text-text-secondary">$</span>
            <input
              type="number"
              min={0}
              step={1}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="flex-1 bg-transparent text-right text-[20px] font-bold tabular-nums text-text-primary focus:outline-none"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="rounded-[18px] bg-bg-secondary px-4">
          {accounts.length > 0 && (
            <div className="flex items-center justify-between border-b border-border-subtle py-3.5">
              <span className="text-sm text-text-secondary">Cuenta</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="max-w-[200px] bg-transparent text-right text-sm font-semibold text-text-primary focus:outline-none"
              >
                <option value="">— sin cuenta —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-between py-3.5">
            <span className="text-sm text-text-secondary">Fecha</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-transparent text-right text-sm font-semibold text-text-primary focus:outline-none [&::-webkit-calendar-picker-indicator]:opacity-50"
            />
          </div>
        </div>

        <div className="rounded-[18px] bg-bg-secondary px-4 py-4">
          <p className="text-xs leading-5 text-text-secondary">
            Este pago va a bajar tu Saldo Vivo, pero no se va a usar para cancelar la deuda pendiente que Gota calcula desde tus consumos registrados.
          </p>
        </div>

        {error && (
          <p className="rounded-[14px] bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
        )}
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 bg-bg-secondary px-6 pb-6 pt-4">
        <button
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || isSaving}
          className="w-full rounded-button bg-primary py-3 text-[14px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95 disabled:opacity-40"
        >
          {isSaving ? 'Registrando…' : 'Registrar pago anterior'}
        </button>
      </div>
    </Modal>
  )
}
