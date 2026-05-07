'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { paymentMethodFromAccountType } from '@/lib/cardPaymentPrompt'
import { formatAmount, todayAR } from '@/lib/format'
import type { Account, Card, Currency } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  card: Card
  accounts: Account[]
  currency: Currency
}

function formatMoneyInput(n: number): string {
  if (n === 0) return ''
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)
}

export function LegacyCardPaymentModal({ open, onClose, onSuccess, card, accounts, currency }: Props) {
  const [montoRaw, setMontoRaw] = useState(0)
  const [accountId, setAccountId] = useState(card.account_id ?? (accounts[0]?.id ?? ''))
  const [fecha, setFecha] = useState(todayAR())
  const [availableBalance, setAvailableBalance] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedAccount = accounts.find((account) => account.id === accountId) ?? null

  useEffect(() => {
    let cancelled = false

    if (!accountId) {
      setAvailableBalance(null)
      return
    }

    void fetch(`/api/dashboard/account-breakdown?currency=${currency}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return
        const match = data?.breakdown?.find?.((account: { id: string; saldo: number }) => account.id === accountId)
        setAvailableBalance(typeof match?.saldo === 'number' ? match.saldo : null)
      })
      .catch(() => {
        if (!cancelled) setAvailableBalance(null)
      })

    return () => {
      cancelled = true
    }
  }, [accountId, currency])

  const exceedsBalance = availableBalance != null && montoRaw > availableBalance + 0.01
  const canSubmit = montoRaw > 0 && !!accountId && !!fecha && !exceedsBalance

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = e.target.value.replace(/\D/g, '')
    setMontoRaw(stripped === '' ? 0 : parseInt(stripped, 10))
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setIsSaving(true)
    setError(null)

    try {
      const paymentMethod = selectedAccount
        ? paymentMethodFromAccountType(selectedAccount.type)
        : 'DEBIT'

      const res = await fetch('/api/card-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: montoRaw,
          currency,
          description: `Pago anterior ${card.name}`,
          payment_method: paymentMethod,
          card_id: card.id,
          account_id: accountId,
          date: fecha,
          is_legacy_card_payment: true,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Error al registrar el pago')
      }
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
        {/* Monto */}
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
            Monto pagado
          </p>
          <div className="flex items-center gap-2 rounded-[18px] bg-bg-tertiary px-4 py-3.5 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-bg-secondary">
            <span className="shrink-0 text-base font-bold text-text-secondary">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={formatMoneyInput(montoRaw)}
              onChange={handleMontoChange}
              className="flex-1 border-0 bg-transparent text-right text-[20px] font-bold tabular-nums text-text-primary focus:outline-none"
              placeholder="0"
            />
          </div>
          {availableBalance != null && (
            <p className="mt-1.5 text-xs text-text-tertiary">
              Disponible hoy: {formatAmount(availableBalance, currency)}
            </p>
          )}
          {exceedsBalance && (
            <p className="mt-1.5 text-xs text-danger">
              El pago supera el saldo actual de la cuenta seleccionada.
            </p>
          )}
        </div>

        {/* Cuenta y Fecha */}
        <div className="overflow-hidden rounded-[18px] bg-bg-tertiary">
          {accounts.length > 0 && (
            <div className="border-b border-border-subtle px-4 py-3.5">
              <p className="mb-2 text-xs text-text-secondary">Cuenta</p>
              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAccountId(a.id)}
                    className={`flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      accountId === a.id
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border-ocean bg-primary/[0.03] text-text-tertiary'
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3.5">
            <span className="text-sm text-text-secondary">Fecha</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="border-0 appearance-none bg-transparent text-right text-sm font-semibold text-text-primary focus:outline-none [&::-webkit-calendar-picker-indicator]:opacity-50"
            />
          </div>
        </div>

        {/* Nota */}
        <div className="rounded-[18px] bg-bg-tertiary px-4 py-4">
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
