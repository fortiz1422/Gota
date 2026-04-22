'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { todayAR } from '@/lib/format'
import type { Account, Card } from '@/types/database'

interface Props {
  accounts: Account[]
  cards: Card[]
  onClose: () => void
}

function formatARS(n: number): string {
  if (n === 0) return ''
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)
}

export function CardPaymentForm({ accounts, cards, onClose }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const activeAccounts = accounts.filter((account) => !account.archived)
  const activeCards = cards.filter((card) => !card.archived)

  const [cardId, setCardId] = useState(activeCards[0]?.id ?? '')
  const selectedCard = activeCards.find((card) => card.id === cardId) ?? null
  const [accountId, setAccountId] = useState(selectedCard?.account_id ?? (activeAccounts[0]?.id ?? ''))
  const [montoRaw, setMontoRaw] = useState(0)
  const [fecha, setFecha] = useState(todayAR())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedCard) return
    setAccountId(selectedCard.account_id ?? (activeAccounts[0]?.id ?? ''))
    // Solo se resetea cuando cambia la tarjeta seleccionada.
    // Si depende de activeAccounts, se pisa la cuenta elegida en cada render.
  }, [cardId, selectedCard])

  const canSubmit = !!selectedCard && !!accountId && !!fecha && montoRaw > 0

  const handleMontoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = e.target.value.replace(/\D/g, '')
    setMontoRaw(stripped === '' ? 0 : parseInt(stripped, 10))
  }

  const handleSubmit = async () => {
    if (!selectedCard || !canSubmit) return
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: montoRaw,
          currency: 'ARS',
          category: 'Pago de Tarjetas',
          description: `Pago ${selectedCard.name}`,
          payment_method: 'DEBIT',
          card_id: selectedCard.id,
          account_id: accountId,
          date: fecha,
          is_want: null,
          is_legacy_card_payment: false,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Error al registrar el pago')
      }

      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['account-breakdown'] })
      router.refresh()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al registrar el pago')
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
      <p className="mb-5 mt-1 text-xs text-text-tertiary">Registrá un pago desde una de tus cuentas</p>

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
                onChange={(e) => setCardId(e.target.value)}
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
                onChange={(e) => setAccountId(e.target.value)}
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
                <p className="mt-1 text-[11px] text-danger">Necesitás al menos una cuenta activa.</p>
              )}
            </div>

            <div>
              <label className={labelCls}>Monto</label>
              <div className="flex items-center gap-2 rounded-input border border-transparent bg-bg-tertiary px-4 py-3 focus-within:border-primary">
                <span className="shrink-0 text-base font-bold text-text-secondary">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatARS(montoRaw)}
                  onChange={handleMontoChange}
                  className="flex-1 border-0 bg-transparent text-right text-[20px] font-bold tabular-nums text-text-primary focus:outline-none"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
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
