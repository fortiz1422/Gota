'use client'
import { useState } from 'react'
import type { Draft, Currency } from '@/lib/reconciliation/domain'
import type { Command } from '@/lib/reconciliation/commands'
import { formatArDecimal, parseArSignedDecimalInput } from '@/lib/ar-input'

export type TransferTarget = {
  accountId: string
  currency: Currency
  targetId: string
  checkpointDay: string
  amount: number
}
export type TransferCandidate = {
  id: string
  date: string
  amount: number
  effect: number
  peerAccountId: string
  peerCurrency: Currency
  peerEffect: number
}
export function TransferDraftForm({
  draft,
  candidate,
  accounts,
  targets,
  corrections,
  currency,
  gap,
  checkpointDay,
  adjusted,
  busy,
  onChange,
  onConfirm,
  onBack,
}: {
  draft: Draft
  candidate?: TransferCandidate
  accounts: { id: string; name: string }[]
  targets: TransferTarget[]
  corrections: { accountId: string; currency: Currency }[]
  currency: Currency
  gap: number
  checkpointDay: string
  adjusted: boolean
  busy: boolean
  onChange: (change: Partial<Draft>) => void
  onConfirm: (
    included: boolean,
    before: boolean,
    peer?: Command['transferPeer']
  ) => Promise<boolean>
  onBack: () => void
}) {
  const [included, setIncluded] = useState(false)
  const [before, setBefore] = useState(false)
  const [peerKey, setPeerKey] = useState('')
  const [peerIncluded, setPeerIncluded] = useState(false)
  const [peerBefore, setPeerBefore] = useState(false)
  const otherId = candidate?.peerAccountId ?? draft.counterAccountId
  const peerCurrency = candidate?.peerCurrency ?? currency
  const peerEffect =
    candidate?.peerEffect ??
    (gap > 0 ? -1 : 1) * Number(draft.amount || 0) * 100
  const date = candidate?.date.slice(0, 10) ?? draft.date
  const options = targets.filter(
    (t) =>
      t.accountId === otherId &&
      t.currency === peerCurrency &&
      Math.sign(t.amount) === Math.sign(peerEffect) &&
      Math.abs(t.amount) >= Math.abs(peerEffect) &&
      date <= t.checkpointDay
  )
  const selected = options.find((t) => (t.targetId || 'checkpoint') === peerKey)
  const hasCorrection =
    !candidate &&
    corrections.some((t) => t.accountId === otherId && t.currency === currency)
  const valid = Boolean(
    otherId &&
    date &&
    (candidate || Number(draft.amount) >= 1) &&
    included &&
    (date !== checkpointDay || before) &&
    (!peerKey ||
      (selected &&
        peerIncluded &&
        (date !== selected.checkpointDay || peerBefore))) &&
    (!hasCorrection || selected)
  )
  const inputClass =
    'mt-2 min-h-12 w-full rounded-input border border-border-strong bg-bg-primary px-4 text-base text-text-primary'
  const format = (n: number, c = currency) =>
    (n / 100).toLocaleString('es-AR', { style: 'currency', currency: c })
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid)
          void onConfirm(
            included,
            before,
            selected
              ? {
                  accountId: selected.accountId,
                  targetId: selected.targetId || undefined,
                  included: peerIncluded,
                  sameDayBefore: peerBefore,
                }
              : undefined
          )
      }}
    >
      <h2 className="type-body-lg">Transferencia entre tus cuentas</h2>
      {candidate && (
        <p className="type-meta text-text-secondary">
          {gap > 0 ? 'Desde' : 'Hacia'}{' '}
          {accounts.find((a) => a.id === otherId)?.name ?? 'otra cuenta'} ·{' '}
          {currency}
        </p>
      )}
      {candidate ? (
        <p className="text-sm">
          {format(candidate.effect)} · {date}
        </p>
      ) : (
        <>
          <label className="block text-sm">
            {gap > 0 ? 'Cuenta de origen' : 'Cuenta de destino'}
            <select
              disabled={busy}
              className={inputClass}
              aria-label={gap > 0 ? 'Cuenta de origen' : 'Cuenta de destino'}
              value={draft.counterAccountId ?? ''}
              onChange={(event) => {
                onChange({ counterAccountId: event.target.value || undefined })
                setPeerKey('')
                setPeerIncluded(false)
                setPeerBefore(false)
              }}
            >
              <option value="">Elegir cuenta</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Importe
            <input
              disabled={busy}
              inputMode="decimal"
              className={inputClass}
              value={formatArDecimal(draft.amount)}
              onChange={(event) =>
                onChange({
                  amount: parseArSignedDecimalInput(event.target.value),
                })
              }
            />
          </label>
          <label className="block text-sm">
            Fecha de la transferencia
            <input
              disabled={busy}
              type="date"
              className={inputClass}
              value={draft.date}
              onChange={(event) => onChange({ date: event.target.value })}
            />
          </label>
        </>
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          disabled={busy}
          type="checkbox"
          checked={included}
          onChange={(event) => setIncluded(event.target.checked)}
        />
        Ya estaba incluida en el saldo confirmado
      </label>
      {date === checkpointDay && (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            disabled={busy}
            type="checkbox"
            checked={before}
            onChange={(event) => setBefore(event.target.checked)}
          />
          Fue antes de confirmar
        </label>
      )}
      {(options.length > 0 || hasCorrection) && (
        <div className="border-separator border-t pt-4">
          <label className="block text-sm">
            Explicar también en {accounts.find((a) => a.id === otherId)?.name}
            <select
              disabled={busy}
              className={inputClass}
              aria-label={`Explicar también en ${accounts.find((a) => a.id === otherId)?.name}`}
              value={peerKey}
              onChange={(event) => {
                setPeerKey(event.target.value)
                setPeerIncluded(false)
                setPeerBefore(false)
              }}
            >
              <option value="">
                {hasCorrection ? 'Elegir diferencia' : 'Sólo esta cuenta'}
              </option>
              {options.map((t) => (
                <option
                  key={t.targetId || 'checkpoint'}
                  value={t.targetId || 'checkpoint'}
                >
                  {t.checkpointDay} · pendiente {format(t.amount, t.currency)}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  disabled={busy}
                  type="checkbox"
                  checked={peerIncluded}
                  onChange={(event) => setPeerIncluded(event.target.checked)}
                />
                Ya estaba incluida en el saldo de la otra cuenta
              </label>
              {date === selected.checkpointDay && (
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    disabled={busy}
                    type="checkbox"
                    checked={peerBefore}
                    onChange={(event) => setPeerBefore(event.target.checked)}
                  />
                  Fue antes de confirmar la otra cuenta
                </label>
              )}
            </>
          )}
          {hasCorrection && !options.length && (
            <p role="status" className="type-meta text-text-secondary mt-2">
              Revisá el saldo de la otra cuenta antes de cargar esta
              transferencia.
            </p>
          )}
        </div>
      )}
      <p className="type-meta text-text-secondary">
        {candidate
          ? 'Usa la transferencia existente.'
          : adjusted
            ? 'Tu saldo se conserva.'
            : 'Reduce la diferencia de esta cuenta.'}{' '}
        {selected
          ? 'Explica ambas diferencias.'
          : !candidate && otherId && peerEffect
            ? `La otra cuenta cambia ${format(peerEffect, peerCurrency)}.`
            : ''}
      </p>
      <button
        disabled={busy || !valid}
        className="rounded-button bg-primary min-h-12 w-full text-sm font-bold text-white disabled:opacity-50"
        type="submit"
      >
        {candidate ? 'Vincular transferencia' : 'Confirmar transferencia'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onBack}
        className="text-primary min-h-11 w-full text-sm"
      >
        Volver
      </button>
    </form>
  )
}
