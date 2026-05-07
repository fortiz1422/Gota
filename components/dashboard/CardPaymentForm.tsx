'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { paymentMethodFromAccountType } from '@/lib/cardPaymentPrompt'
import { formatAmount, todayAR } from '@/lib/format'
import type { Account, Card, Currency } from '@/types/database'

interface Props {
  accounts: Account[]
  cards: Card[]
  onClose: () => void
  defaultCurrency: Currency
}

function formatMoneyInput(n: number): string {
  if (n === 0) return ''
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)
}

export function CardPaymentForm({ accounts, cards, onClose, defaultCurrency }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const activeAccounts = accounts.filter((account) => !account.archived)
  const activeCards = cards.filter((card) => !card.archived)

  const [cardId, setCardId] = useState(activeCards[0]?.id ?? '')
  const selectedCard = activeCards.find((card) => card.id === cardId) ?? null
  const [accountId, setAccountId] = useState(selectedCard?.account_id ?? (activeAccounts[0]?.id ?? ''))
  const selectedAccount = activeAccounts.find((account) => account.id === accountId) ?? null
  const [currency, setCurrency] = useState<Currency>(defaultCurrency)
  const [montoRaw, setMontoRaw] = useState(0)
  const [fecha, setFecha] = useState(todayAR())
  const [availableBalance, setAvailableBalance] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedCard) return
    setAccountId(selectedCard.account_id ?? (activeAccounts[0]?.id ?? ''))
    // Solo se resetea cuando cambia la tarjeta seleccionada.
    // Si depende de activeAccounts, se pisa la cuenta elegida en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, selectedCard])

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
  const canSubmit = !!selectedCard && !!accountId && !!fecha && montoRaw > 0 && !exceedsBalance

  const handleMontoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = event.target.value.replace(/\D/g, '')
    setMontoRaw(stripped === '' ? 0 : parseInt(stripped, 10))
  }

  const handleSubmit = async () => {
    if (!selectedCard || !canSubmit) return

    setIsSaving(true)
    setError(null)

    try {
      const payment_method = selectedAccount
        ? paymentMethodFromAccountType(selectedAccount.type)
        : 'DEBIT'

      const response = await fetch('/api/card-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: montoRaw,
          currency,
          card_id: selectedCard.id,
          account_id: accountId,
          payment_method,
          description: `Pago ${selectedCard.name}`,
          date: fecha,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error ?? 'Error al registrar el pago')
      }

      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
      router.refresh()
      onClose()
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Error al registrar el pago')
    } finally {
      setIsSaving(false)
    }
  }

  const labelCls = 'mb-1.5 block text-[10px] font-medium uppercase tracking-wider text-text-secondary'
  const inputCls =
    'w-full rounded-input border border-transparent bg-bg-tertiary px-4 py-3 text-sm text-text-primary focus:border-primary focus:outline-none'

  return (
    <Modal open onClose={onClose}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-text-disabled sm:hidden" />
      <h2 className="text-lg font-semibold text-text-primary">Pago de tarjeta</h2>
      <p className="mb-5 mt-1 text-xs text-text-tertiary">
        Se aplica primero al resumen pendiente mas cercano. Si no hay uno, queda como adelanto.
      </p>

      {activeCards.length === 0 ? (
        <div className="space-y-4">
          <p className="rounded-card bg-bg-tertiary px-4 py-4 text-sm text-text-secondary">
            No hay tarjetas activas para registrar pagos.
          </p>
          <button
            onClick={onClose}
            className="w-full rounded-button py-3 text-sm text-text-secondary"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Tarjeta</label>
              <select
                value={cardId}
                onChange={(event) => setCardId(event.target.value)}
                className={inputCls}
              >
                {activeCards.map((card) => (
                  <option key={card.id} value={card.id}>
                    {card.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelCls}>Cuenta</label>
              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                className={inputCls}
                disabled={activeAccounts.length === 0}
              >
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              {activeAccounts.length === 0 && (
                <p className="mt-1 text-[11px] text-danger">Necesitas al menos una cuenta activa.</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Moneda</label>
              <div className="flex gap-2">
                {(['ARS', 'USD'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setCurrency(option)}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold ${
                      currency === option
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border-ocean bg-primary/[0.03] text-text-tertiary'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Monto</label>
              <div className="flex items-center gap-2 rounded-input border border-transparent bg-bg-tertiary px-4 py-3 focus-within:border-primary">
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
                <p className="mt-1 text-[11px] text-text-tertiary">
                  Disponible hoy: {formatAmount(availableBalance, currency)}
                </p>
              )}
              {exceedsBalance && (
                <p className="mt-1 text-[11px] text-danger">
                  El pago supera el saldo actual de la cuenta seleccionada.
                </p>
              )}
            </div>

            <div>
              <label className={labelCls}>Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
                className={inputCls}
              />
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}
          </div>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || isSaving}
              className="w-full rounded-button bg-primary py-3 text-sm font-semibold text-bg-primary transition-transform active:scale-95 hover:scale-[1.02] disabled:opacity-50"
            >
              {isSaving ? 'Guardando...' : 'Registrar pago'}
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-button py-3 text-sm text-text-secondary"
            >
              Cancelar
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
