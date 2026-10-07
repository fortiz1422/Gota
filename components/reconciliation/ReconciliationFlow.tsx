'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowClockwise } from '@phosphor-icons/react'
import {
  balanceCorrection,
  remaining,
  observedResidual,
  checkpointDay,
  type Workspace,
  type Draft,
} from '@/lib/reconciliation/domain'
import type { Command } from '@/lib/reconciliation/commands'
import { formatArDecimal, parseArSignedDecimalInput } from '@/lib/ar-input'
import { MovementDraftSteps } from './MovementDraftSteps'
import { restoreDraft } from '@/lib/reconciliation/draft'
import { hasPendingExplanation } from '@/lib/reconciliation/tasks'

type Candidate = {
  id: string
  description: string
  amount: number
  date: string
}
type Data = {
  userId: string
  candidates: Candidate[]
  account: { id: string; name: string }
  state: Workspace
  version: number
  expected: number
  fingerprint: string
}
const blank: Draft = { amount: '', description: '', category: '', date: '' }
const money = (minor: number, currency: string) =>
  (minor / 100).toLocaleString('es-AR', { style: 'currency', currency })
const inputClass =
  'min-h-12 w-full rounded-input border border-border-strong bg-bg-primary px-4 text-base text-text-primary'
const buttonClass =
  'min-h-12 w-full rounded-button bg-primary px-4 text-sm font-bold text-white disabled:opacity-50'

export function ReconciliationFlow({
  accountId,
  currency,
}: {
  accountId: string
  currency: 'ARS' | 'USD'
}) {
  const cache = useQueryClient()
  const endpoint = `/api/reconciliation?accountId=${encodeURIComponent(accountId)}&currency=${currency}`
  const query = useQuery<Data>({
    queryKey: ['reconciliation', accountId, currency],
    queryFn: async () => {
      const response = await fetch(endpoint)
      if (!response.ok) throw new Error('No pudimos cargar esta cuenta.')
      return response.json()
    },
    refetchOnWindowFocus: true,
  })
  const [amount, setAmount] = useState('')
  const [draft, setDraft] = useState<Draft>(blank)
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [existingIncluded, setExistingIncluded] = useState(false)
  const [existingBefore, setExistingBefore] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState(false)
  const draftRef = useRef(draft)
  const initialized = useRef(false)
  const saving = useRef(false)
  const retry = useRef<{ signature: string; command: Command } | null>(null)
  const data = query.data
  useEffect(() => {
    if (!data || initialized.current) return
    initialized.current = true
    let restored = data.state.draft
    try {
      restored =
        restoreDraft(
          localStorage.getItem(
            `gota:reconciliation:v1:${data.userId}:${accountId}:${currency}:${data.state.checkpoints.at(-1)?.id ?? 'new'}`
          )
        ) ?? restored
    } catch {
      /* Server draft remains available when storage is disabled. */
    }
    if (restored) {
      setDraft(restored)
      draftRef.current = restored
      setEditing(true)
    }
  }, [accountId, currency, data])
  const command = useCallback(
    async (
      payload: Omit<Command, 'requestId' | 'version' | 'fingerprint'>,
      quiet = false
    ) => {
      if (!data || saving.current) return false
      saving.current = true
      setBusy(true)
      if (!quiet) setError('')
      const signature = JSON.stringify(payload)
      const envelope: Command =
        retry.current?.signature === signature
          ? retry.current.command
          : {
              ...payload,
              requestId: crypto.randomUUID(),
              version: data.version,
              fingerprint: data.fingerprint,
            }
      retry.current = { signature, command: envelope }
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(envelope),
        })
        const result = await response.json()
        if (!response.ok) {
          if (response.status === 409) {
            retry.current = null
            await query.refetch()
          }
          throw new Error(result.error ?? 'No se guardó. Reintentá.')
        }
        retry.current = null
        await query.refetch()
        await Promise.all([
          cache.invalidateQueries({ queryKey: ['dashboard'] }),
          cache.invalidateQueries({ queryKey: ['intelligence', 'signals'] }),
        ])
        return true
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'No se guardó. Reintentá.'
        )
        return false
      } finally {
        saving.current = false
        setBusy(false)
      }
    },
    [cache, data, endpoint, query]
  )
  const draftKey = data
    ? `gota:reconciliation:v1:${data.userId}:${accountId}:${currency}:${data.state.checkpoints.at(-1)?.id ?? 'new'}`
    : null
  const changeDraft = (change: Partial<Draft>) => {
    const next = { ...draftRef.current, ...change }
    draftRef.current = next
    setDraft(next)
    if (draftKey) {
      try {
        localStorage.setItem(draftKey, JSON.stringify(next))
      } catch {
        setError('Guardá el borrador antes de salir.')
      }
    }
  }
  const clearDraft = () => {
    setEditing(false)
    setDraft(blank)
    draftRef.current = blank
    if (draftKey) {
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* Already saved on server. */
      }
    }
  }
  if (query.isLoading)
    return (
      <p role="status" className="text-text-secondary p-6">
        Cargando saldo…
      </p>
    )
  if (!data)
    return (
      <div className="p-6">
        <p role="alert">{query.error?.message}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="text-primary mt-4 min-h-11"
        >
          Reintentar
        </button>
      </div>
    )
  const checkpoint = data.state.checkpoints.at(-1)
  const openAdjustments = data.state.adjustments.filter(
    (a) => !a.reversedAt && !a.manuallyClosed && remaining(data.state, a) !== 0
  )
  const adjustment = openAdjustments[0]
  const targetCheckpoint = adjustment
    ? data.state.checkpoints.find((c) => c.id === adjustment.checkpointId)
    : checkpoint
  const candidates = data.candidates.filter(
    (c) =>
      targetCheckpoint &&
      c.date.slice(0, 10) <= checkpointDay(targetCheckpoint.observedAt) &&
      !targetCheckpoint.includedMovementIds.includes(`expense:${c.id}`) &&
      !data.state.resolutions.some(
        (r) => r.movementId === c.id && !r.reversedAt
      )
  )
  const isCheck = data.state.step === 'check'
  const isResolve =
    data.state.step === 'resolve' ||
    (data.state.step === 'resolved' && hasPendingExplanation(data.state))
  const settled =
    data.state.step === 'resolved' && !hasPendingExplanation(data.state)

  return (
    <div className="min-h-app mx-auto max-w-lg px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-10">
      <header className="mb-8 flex items-center gap-3">
        <Link
          href="/"
          aria-label="Volver a Home"
          className="text-primary grid h-11 w-11 place-items-center"
        >
          <ArrowLeft size={20} weight="light" />
        </Link>
        <div>
          <p className="type-meta text-text-tertiary">{currency}</p>
          <h1 className="type-title text-text-primary">{data.account.name}</h1>
        </div>
      </header>
      {error && (
        <p role="alert" className="text-danger mb-4 text-sm">
          {error}
        </p>
      )}
      <div aria-busy={busy}>
        {settled ? (
          <div role="status" className="space-y-4">
            <h2 className="type-body-lg">
              Listo, esta diferencia está cerrada.
            </h2>
            <p className="text-text-secondary text-sm">
              Saldo actual: {money(data.expected, currency)}
            </p>
            <Link
              href="/"
              className="rounded-button bg-primary flex min-h-12 items-center justify-center text-sm font-bold text-white"
            >
              Volver a Home
            </Link>
          </div>
        ) : isCheck ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void command({ action: 'confirm', amount })
            }}
            className="space-y-5"
          >
            <h2 className="type-body-lg">¿Cuánto tenés disponible?</h2>
            <p className="type-meta text-text-secondary">
              Gota calcula {money(data.expected, currency)}
            </p>
            <label className="block">
              <span className="sr-only">Saldo disponible en {currency}</span>
              <input
                autoFocus
                inputMode="decimal"
                value={formatArDecimal(amount)}
                onChange={(event) =>
                  setAmount(parseArSignedDecimalInput(event.target.value))
                }
                placeholder="0"
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              disabled={busy || !amount || amount === '-'}
              className={buttonClass}
            >
              {busy ? 'Guardando…' : 'Confirmar saldo'}
            </button>
            {checkpoint && checkpoint.delta === 0 && (
              <p role="status" className="text-success text-sm">
                Saldo confirmado.
              </p>
            )}
          </form>
        ) : (
          <section className="space-y-5">
            <div>
              <p className="type-meta text-text-secondary">
                {adjustment && isResolve
                  ? 'Pendiente de explicar'
                  : 'Diferencia de saldo'}
              </p>
              <p className="type-hero text-text-primary mt-1">
                {money(
                  adjustment && isResolve
                    ? remaining(data.state, adjustment)
                    : checkpoint
                      ? observedResidual(data.state, checkpoint)
                      : 0,
                  currency
                )}
              </p>
            </div>
            {!isResolve && checkpoint && (
              <dl className="divide-separator divide-y text-sm">
                <div className="flex justify-between py-3">
                  <dt>Gota calculaba</dt>
                  <dd>{money(checkpoint.expected, currency)}</dd>
                </div>
                <div className="flex justify-between py-3">
                  <dt>Confirmaste</dt>
                  <dd>{money(checkpoint.confirmed, currency)}</dd>
                </div>
              </dl>
            )}
            {!isResolve ? (
              <>
                <button
                  disabled={busy}
                  onClick={() => void command({ action: 'start' })}
                  className={buttonClass}
                >
                  Resolver ahora
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void command({ action: 'adjust', targetId: checkpoint?.id })
                  }
                  className="rounded-button border-border-strong text-primary min-h-12 w-full border text-sm font-bold"
                >
                  Ajustar y seguir
                </button>
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (await command({ action: 'later' }))
                      window.location.assign('/')
                  }}
                  className="text-text-secondary min-h-11 w-full text-sm"
                >
                  Después
                </button>
              </>
            ) : (
              <>
                {!adjustment && (
                  <p className="text-text-secondary text-sm">
                    Todavía no aplicaste un ajuste.
                  </p>
                )}
                {!editing && !selected ? (
                  <div className="space-y-3">
                    {candidates.map((c) => (
                      <button
                        key={c.id}
                        disabled={busy}
                        type="button"
                        onClick={() => {
                          setSelected(c)
                          setExistingIncluded(false)
                          setExistingBefore(false)
                        }}
                        className="border-separator text-primary flex min-h-14 w-full justify-between border-b py-3 text-sm"
                      >
                        <span>{c.description}</span>
                        <span>{money(c.amount * 100, currency)}</span>
                      </button>
                    ))}
                    <button
                      disabled={busy}
                      onClick={() => {
                        setEditing(true)
                        void command({ action: 'draft', draft: blank })
                      }}
                      className={buttonClass}
                    >
                      Encontré un movimiento
                    </button>
                    <Link
                      href="/mercadopago/review"
                      className="text-primary flex min-h-12 items-center justify-center text-sm font-bold"
                    >
                      Revisar Mercado Pago
                    </Link>
                    <Link
                      href="/movimientos"
                      className="text-primary flex min-h-12 items-center justify-center text-sm font-bold"
                    >
                      Revisar movimientos
                    </Link>
                  </div>
                ) : selected ? (
                  <div className="space-y-4">
                    <p className="type-body-lg">
                      {selected.description} ·{' '}
                      {money(selected.amount * 100, currency)}
                    </p>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={existingIncluded}
                        onChange={(event) =>
                          setExistingIncluded(event.target.checked)
                        }
                      />
                      Ya estaba incluido en el saldo confirmado
                    </label>
                    {selected.date.slice(0, 10) ===
                      (targetCheckpoint
                        ? checkpointDay(targetCheckpoint.observedAt)
                        : '') && (
                      <label className="flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={existingBefore}
                          onChange={(event) =>
                            setExistingBefore(event.target.checked)
                          }
                        />
                        Fue antes de confirmar
                      </label>
                    )}
                    <button
                      disabled={busy || !existingIncluded}
                      onClick={async () => {
                        if (
                          await command({
                            action: 'resolve',
                            targetId: adjustment?.id,
                            movementKind: 'expense',
                            movementId: selected.id,
                            included: existingIncluded,
                            sameDayBefore: existingBefore,
                          })
                        )
                          setSelected(null)
                      }}
                      className={buttonClass}
                    >
                      Vincular movimiento
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => setSelected(null)}
                      className="text-primary min-h-11"
                    >
                      Volver
                    </button>
                  </div>
                ) : (
                  <MovementDraftSteps
                    draft={draft}
                    busy={busy}
                    checkpointDay={
                      (targetCheckpoint
                        ? checkpointDay(targetCheckpoint.observedAt)
                        : '') ?? ''
                    }
                    adjusted={Boolean(adjustment)}
                    onChange={changeDraft}
                    onSave={() =>
                      command(
                        { action: 'draft', draft: draftRef.current },
                        true
                      )
                    }
                    onConfirm={async (included, sameDayBefore) => {
                      const saved = await command({
                        action: 'resolve',
                        targetId: adjustment?.id,
                        draft: draftRef.current,
                        included,
                        sameDayBefore,
                      })
                      if (saved) clearDraft()
                      return saved
                    }}
                  />
                )}
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (await command({ action: 'later' }))
                      window.location.assign('/')
                  }}
                  className="text-text-secondary min-h-11 w-full text-sm"
                >
                  Seguir después
                </button>
              </>
            )}
          </section>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setEditing(false)
            void command({ action: 'check' })
          }}
          className="text-primary mt-6 flex min-h-11 items-center gap-2 text-sm"
        >
          <ArrowClockwise size={16} weight="light" />
          Confirmar saldo de nuevo
        </button>
        <details
          className="border-separator mt-6 border-t pt-4"
          open={history}
          onToggle={(event) => setHistory(event.currentTarget.open)}
        >
          <summary className="text-text-secondary cursor-pointer text-sm">
            Ver historial
          </summary>
          <div className="mt-4 space-y-4">
            <p className="type-meta text-text-secondary">
              Corrección neta vigente:{' '}
              {money(balanceCorrection(data.state), currency)}
            </p>
            {data.state.checkpoints.map((c) => (
              <p key={c.id} className="type-meta text-text-secondary">
                {new Date(c.observedAt).toLocaleString('es-AR', {
                  timeZone: 'America/Argentina/Buenos_Aires',
                })}{' '}
                · {money(c.confirmed, currency)}
              </p>
            ))}
            {data.state.resolutions
              .filter((r) => !r.reversedAt)
              .map((r) => (
                <button
                  key={r.id}
                  disabled={busy}
                  onClick={() =>
                    void command({ action: 'undo', targetId: r.id })
                  }
                  className="text-primary block min-h-11 text-sm"
                >
                  Desvincular {money(r.effect, currency)}
                </button>
              ))}
            {data.state.adjustments
              .filter((a) => !a.reversedAt)
              .map((a) => (
                <div key={a.id} className="flex flex-wrap gap-4">
                  {!a.manuallyClosed && remaining(data.state, a) !== 0 && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void command({ action: 'close', targetId: a.id })
                      }
                      className="text-text-secondary min-h-11 text-sm"
                    >
                      Dejar de buscar esta diferencia
                    </button>
                  )}
                  <button
                    disabled={
                      busy ||
                      data.state.resolutions.some(
                        (r) => r.adjustmentId === a.id && !r.reversedAt
                      )
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          `¿Revertir este ajuste? Tu saldo cambiará ${money(-a.amount, currency)}.`
                        )
                      )
                        void command({ action: 'reverse', targetId: a.id })
                    }}
                    className="text-primary min-h-11 text-sm"
                  >
                    Revertir ajuste
                  </button>
                </div>
              ))}
          </div>
        </details>
      </div>
    </div>
  )
}
