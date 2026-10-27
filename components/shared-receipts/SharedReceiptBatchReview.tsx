'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, Receipt } from '@phosphor-icons/react'
import { BlueHeaderZone } from '@/components/ui/BlueHeaderZone'
import { Modal } from '@/components/ui/Modal'
import { MerchantMemoryFields } from './MerchantMemoryFields'
import {
  BULK_RECEIPT_LIMIT,
  RECEIPT_ANALYSIS_INTERVAL_MS,
  createBulkDraft,
  draftBlockers,
  categoryOriginLabel,
  sameDetectedMerchant,
  receiptDuplicateAmounts,
  type BulkReceiptDraft,
} from '@/lib/shared-receipts/bulk-review'
import {
  SHARED_RECEIPT_ROUTES,
  normalizePendingMerchantMemoryRetries,
  normalizeReceiptResponse,
  normalizeReceiptsResponse,
  requireReferenceArray,
  invalidateAfterSharedReceiptConfirmation,
} from '@/lib/shared-receipts-ui'
import {
  parsePendingMerchantMemory,
  pendingMerchantMemoryFromDraft,
  retryDraftFromPending,
  type PendingMerchantMemory,
} from '@/lib/shared-receipts/pending-merchant-memory'
import { fetchPossibleExpenseDuplicates } from '@/lib/expense-duplicates'
import {
  merchantMemoryError,
  planBulkMerchantMemory,
  saveBulkMerchantMemory,
  type MerchantMemory,
  type MerchantProfileOption,
} from '@/lib/counterparty-aliases/bulk-memory'
import { CATEGORIES } from '@/lib/validation/schemas'
import { formatAmount, formatDate } from '@/lib/format'
import type { BulkConfirmationResult } from '@/lib/shared-receipts/bulk-confirmation'
import { sharedReceiptExpiryPresentation } from '@/lib/shared-receipts/expiry'
import { usePaidAICapability } from '@/hooks/usePaidAICapability'
import type { Account, Card } from '@/types/database'

const field =
  'min-h-11 w-full min-w-0 rounded-button border border-border-strong bg-bg-tertiary px-3 py-2 text-base text-text-primary'
async function checkedJson(response: Response) {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error =
      body && typeof body === 'object' && 'error' in body
        ? String(body.error)
        : 'No pudimos completar la solicitud. Reintentá.'
    throw new Error(error)
  }
  return body
}
function waitForAnalysisSlot(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, ms)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}

export function SharedReceiptBatchReview() {
  const queryClient = useQueryClient()
  const { allowed: paidAIAllowed, resolved: paidAIResolved } =
    usePaidAICapability()
  const [drafts, setDrafts] = useState<BulkReceiptDraft[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [remainingCount, setRemainingCount] = useState(0)
  const [memory, setMemory] = useState<Record<string, MerchantMemory>>({})
  const [profiles, setProfiles] = useState<MerchantProfileOption[]>([])
  const [profilesError, setProfilesError] = useState<string | null>(null)
  const profilesRequested = useRef(false)
  const [memoryFailures, setMemoryFailures] = useState<string[]>([])
  // A refreshed inbox no longer contains confirmed receipts. Keep the evidence
  // needed to retry merchant memory independently of the current review batch.
  const memoryFailureDrafts = useRef(new Map<string, BulkReceiptDraft>())
  const [image, setImage] = useState<{ url: string | null; id: string } | null>(
    null
  )
  const [revision, setRevision] = useState(0)
  const duplicateChecks = useRef(new Map<string, string>())
  const submitLock = useRef(false)
  const memorySnapshot = useRef<Record<string, MerchantMemory>>({})

  const persistPendingAliasRetry = async (
    receiptId: string,
    payload: PendingMerchantMemory
  ): Promise<boolean> => {
    try {
      const response = await fetch(
        SHARED_RECEIPT_ROUTES.pendingMerchantMemory(receiptId),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      return response.ok
    } catch {
      return false
    }
  }
  const claimPendingAliasRetry = async (receiptId: string): Promise<boolean> => {
    try {
      const response = await fetch(
        SHARED_RECEIPT_ROUTES.pendingMerchantMemory(receiptId),
        { method: 'DELETE' }
      )
      return response.ok
    } catch {
      return false
    }
  }
  useEffect(() => {
    memorySnapshot.current = memory
  }, [memory])

  const hydratePendingAliasRetries = (
    retries: ReturnType<typeof normalizePendingMerchantMemoryRetries>
  ) => {
    if (!retries.length) return
    const parsed = retries
      .map((retry) => {
        const pending = parsePendingMerchantMemory(retry)
        return pending ? { receiptId: retry.receiptId, pending } : null
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
    for (const retry of parsed) {
      memoryFailureDrafts.current.set(
        retry.receiptId,
        retryDraftFromPending(retry.pending, retry.receiptId)
      )
      memorySnapshot.current[retry.receiptId] = retry.pending.memory
    }
    setMemory((current) => {
      const next = { ...current }
      for (const retry of parsed) next[retry.receiptId] = retry.pending.memory
      return next
    })
    setMemoryFailures((current) => [
      ...new Set([...current, ...parsed.map((retry) => retry.receiptId)]),
    ])
  }

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    const get = async (url: string) =>
      checkedJson(await fetch(url, { cache: 'no-store', signal }))
    const publish = (draft: BulkReceiptDraft) => {
      if (signal.aborted) return
      setDrafts((current) => {
        const exists = current.some(
          (row) => row.receipt.id === draft.receipt.id
        )
        return exists
          ? current.map((row) =>
              row.receipt.id === draft.receipt.id ? draft : row
            )
          : [...current, draft]
      })
      setMemory((current) => ({
        ...current,
        [draft.receipt.id]: current[draft.receipt.id] ?? {
          enabled: false,
          mode: draft.receipt.alias_match ? 'existing' : 'new',
          name:
            draft.receipt.alias_match?.display_name ??
            draft.payload.description,
          profileId: draft.receipt.alias_match?.profile_id ?? '',
        },
      }))
    }
    void (async () => {
      setLoading(true)
      setError(null)
      duplicateChecks.current.clear()
      try {
        const [inbox, loadedAccounts, loadedCards, capabilities] =
          await Promise.all([
            get(SHARED_RECEIPT_ROUTES.inbox),
            get('/api/accounts'),
            get('/api/cards'),
            fetch('/api/capabilities', { cache: 'no-store', signal })
              .then(async (response) =>
                response.ok ? await response.json() : null
              )
              .catch(() => null),
          ])
        const paidAiAvailable =
          capabilities &&
          typeof capabilities === 'object' &&
          'paidAI' in capabilities &&
          capabilities.paidAI === true
        if (signal.aborted) return
        const accountList = requireReferenceArray<Account>(
          loadedAccounts,
          'cuentas'
        ).filter((a) => !a.archived)
        const cardList = requireReferenceArray<Card>(
          loadedCards,
          'tarjetas'
        ).filter((c) => !c.archived)
        setAccounts(accountList)
        setCards(cardList)
        hydratePendingAliasRetries(normalizePendingMerchantMemoryRetries(inbox))
        const summaries = normalizeReceiptsResponse(inbox)
        const batch = summaries.slice(0, BULK_RECEIPT_LIMIT)
        setRemainingCount(Math.max(0, summaries.length - batch.length))
        setDrafts([])
        const received: string[] = []
        // Small bounded read batches; a failed detail never hides the rest of the inbox.
        for (let offset = 0; offset < batch.length; offset += 4) {
          await Promise.all(
            batch.slice(offset, offset + 4).map(async (summary) => {
              try {
                const receipt = normalizeReceiptResponse(
                  await get(SHARED_RECEIPT_ROUTES.apiDetail(summary.id))
                )
                if (receipt) {
                  publish(createBulkDraft(receipt, accountList, cardList))
                  if (receipt.status === 'received') received.push(receipt.id)
                }
              } catch {
                if (!signal.aborted)
                  publish({
                    ...createBulkDraft(summary, accountList, cardList),
                    error:
                      'No pudimos cargar este comprobante. Abrí su revisión individual o reintentá.',
                  })
              }
            })
          )
        }
        if (signal.aborted) return
        setLoading(false)
        setPreparing(paidAiAvailable && received.length > 0)
        if (paidAiAvailable) {
          // Read before opening a receipt. Persisted analyses are reused; failures need an explicit retry.
          let lastStarted = 0
          for (const receiptId of received) {
            if (signal.aborted) return
            await waitForAnalysisSlot(
              Math.max(
                0,
                RECEIPT_ANALYSIS_INTERVAL_MS - (Date.now() - lastStarted)
              ),
              signal
            )
            lastStarted = Date.now()
            const response = await fetch(
              SHARED_RECEIPT_ROUTES.analyze(receiptId),
              { method: 'POST', signal }
            )
            if (
              response.status === 429 ||
              response.status === 403 ||
              response.status === 401
            ) {
              const body = (await response.json().catch(() => null)) as {
                error?: string
              } | null
              setError(
                body?.error ??
                  'La preparación quedó pausada. Podés revisar los ya leídos.'
              )
              break
            }
            // Always reload canonical state, including when another session claimed the analysis.
            const receipt = normalizeReceiptResponse(
              await get(SHARED_RECEIPT_ROUTES.apiDetail(receiptId))
            )
            if (receipt) publish(createBulkDraft(receipt, accountList, cardList))
          }
        }
      } catch (reason) {
        if (!signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'No pudimos preparar la tanda.'
          )
      } finally {
        if (!signal.aborted) {
          setLoading(false)
          setPreparing(false)
        }
      }
    })()
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    for (const draft of drafts) {
      if (
        draft.confirmed ||
        draft.receipt.status !== 'needs_review' ||
        !draft.evidence ||
        draft.payload.amount <= 0 ||
        !draft.payload.date
      )
        continue
      const key = JSON.stringify([
        draft.payload.amount,
        draft.payload.currency,
        draft.payload.date,
        draft.payload.installments,
        draft.payload.payment_method,
      ])
      if (duplicateChecks.current.get(draft.receipt.id) === key) continue
      duplicateChecks.current.set(draft.receipt.id, key)
      void Promise.all(
        receiptDuplicateAmounts(draft.payload).map((amount) =>
          fetchPossibleExpenseDuplicates({ ...draft.payload, amount })
        )
      )
        .then((groups) => {
          const duplicates = groups.flat()
          if (duplicateChecks.current.get(draft.receipt.id) !== key) return
          setDrafts((current) =>
            current.map((row) =>
              row.receipt.id === draft.receipt.id
                ? {
                    ...row,
                    duplicates: duplicates.length ? 'possible' : 'clear',
                  }
                : row
            )
          )
        })
        .catch(() => {
          if (duplicateChecks.current.get(draft.receipt.id) !== key) return
          setDrafts((current) =>
            current.map((row) =>
              row.receipt.id === draft.receipt.id
                ? { ...row, duplicates: 'error' }
                : row
            )
          )
        })
    }
    // Requests remain useful across unrelated row edits. Key guards discard stale financial checks.
  }, [drafts])

  const needsProfiles = Object.values(memory).some((value) => value.enabled)
  useEffect(() => {
    if (!needsProfiles || profilesRequested.current) return
    profilesRequested.current = true
    void fetch('/api/counterparty-profiles', { cache: 'no-store' })
      .then(checkedJson)
      .then((body) => {
        const data = body as { profiles?: MerchantProfileOption[] }
        setProfiles(data.profiles ?? [])
      })
      .catch(() =>
        setProfilesError(
          'No pudimos cargar tus comercios. Podés crear uno nuevo.'
        )
      )
  }, [needsProfiles])

  const patchPayload = (
    id: string,
    patch: Partial<BulkReceiptDraft['payload']>
  ) => {
    if (
      'amount' in patch ||
      'currency' in patch ||
      'date' in patch ||
      'installments' in patch ||
      'payment_method' in patch
    )
      duplicateChecks.current.delete(id)
    setDrafts((current) =>
      current.map((row) => {
        if (row.receipt.id !== id) return row
        const financial =
          'amount' in patch ||
          'currency' in patch ||
          'date' in patch ||
          'installments' in patch ||
          'payment_method' in patch
        return {
          ...row,
          payload: { ...row.payload, ...patch },
          error: undefined,
          ...(financial ? { duplicates: 'unchecked' as const } : {}),
          ...('category' in patch
            ? {
                categoryOrigin: 'user' as const,
                decisions: { ...row.decisions, categoryReviewed: true },
              }
            : {}),
        }
      })
    )
  }
  const live = drafts.filter((row) => !row.confirmed)
  const ready = live.filter(
    (row) =>
      !draftBlockers(row).length &&
      !row.error &&
      !merchantMemoryError(
        memory[row.receipt.id] ?? {
          enabled: false,
          mode: 'new',
          name: '',
          profileId: '',
        }
      )
  )
  const readyIds = new Set(ready.map((row) => row.receipt.id))
  const pending = live.filter((row) => !readyIds.has(row.receipt.id))
  const selected = ready.filter((row) => row.selected)

  const rememberMerchant = async (
    draft: BulkReceiptDraft,
    choice: MerchantMemory
  ): Promise<MerchantMemory> => {
    let effective = choice
    await saveBulkMerchantMemory({
      memory: choice,
      detectedAlias:
        draft.receipt.detected_alias ??
        draft.evidence?.merchant_or_counterparty ??
        '',
      category: draft.payload.category,
      match: draft.receipt.alias_match,
      onProfileCreated: (profileId) => {
        effective = { ...effective, mode: 'existing', profileId }
        memorySnapshot.current[draft.receipt.id] = effective
        setMemory((current) => ({
          ...current,
          [draft.receipt.id]: effective,
        }))
      },
    })
    return effective
  }
  const confirm = async () => {
    if (submitLock.current || !selected.length) return
    submitLock.current = true
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const memoryPlan = planBulkMerchantMemory(
        selected.map((row) => ({
          id: row.receipt.id,
          detectedAlias:
            row.receipt.detected_alias ??
            row.evidence?.merchant_or_counterparty ??
            '',
          category: row.payload.category,
          memory: memory[row.receipt.id] ?? {
            enabled: false,
            mode: 'new',
            name: '',
            profileId: '',
          },
        }))
      )
      const body = (await checkedJson(
        await fetch('/api/shared-receipts/bulk-confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entries: selected.map((row) => ({
              id: row.receipt.id,
              payload: row.payload,
              decisions: row.decisions,
            })),
          }),
        })
      )) as { results?: BulkConfirmationResult[] }
      if (!Array.isArray(body.results))
        throw new Error(
          'No pudimos verificar el resultado. Reintentá la misma tanda; no se duplica.'
        )
      const results = body.results
      setDrafts((current) =>
        current.map((row) => {
          const result = results.find((item) => item.id === row.receipt.id)
          if (!result) return row
          return result.outcome === 'confirmed' || result.outcome === 'replay'
            ? { ...row, confirmed: true }
            : {
                ...row,
                error:
                  'message' in result
                    ? result.message
                    : 'No pudimos verificar el resultado.',
              }
        })
      )
      const saved = results.filter(
        (result) =>
          result.outcome === 'confirmed' || result.outcome === 'replay'
      )
      setNotice(
        `${saved.length} confirmados. ${results.length - saved.length} sin confirmar. Los demás siguen pendientes.`
      )
      void invalidateAfterSharedReceiptConfirmation(queryClient)
      for (const group of memoryPlan) {
        const result = saved.find((item) => group.includes(item.id))
        if (!result) continue
        const draft = selected.find((row) => row.receipt.id === result.id)
        const choice = memory[result.id]
        if (!draft || !choice?.enabled) continue
        try {
          const effective = await rememberMerchant(draft, choice)
          setMemory((current) => ({ ...current, [result.id]: effective }))
        } catch {
          const pending = pendingMerchantMemoryFromDraft(
            draft,
            memorySnapshot.current[result.id] ?? choice
          )
          if (!pending) continue
          const persisted = await persistPendingAliasRetry(result.id, pending)
          if (!persisted) {
            setError(
              'El gasto quedó guardado, pero no pudimos conservar el reintento de alias. Reintentá desde la revisión individual.'
            )
            continue
          }
          memoryFailureDrafts.current.set(result.id, draft)
          setMemoryFailures((current) => [...new Set([...current, result.id])])
        }
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No pudimos confirmar la tanda. Reintentá sin duplicarla.'
      )
    } finally {
      submitLock.current = false
      setBusy(false)
    }
  }

  const renderRow = (draft: BulkReceiptDraft, isReady: boolean) => {
    const id = draft.receipt.id
    const reasons = draftBlockers(draft, {
      paidAiAvailable: paidAIResolved ? paidAIAllowed : undefined,
    })
    const expiry =
      draft.receipt.expires_at
        ? sharedReceiptExpiryPresentation(draft.receipt.expires_at)
        : null
    const choice = memory[id] ?? {
      enabled: false,
      mode: 'new' as const,
      name: draft.payload.description,
      profileId: '',
    }
    const matching = live.filter(
      (other) =>
        other.receipt.id !== id &&
        !readyIds.has(other.receipt.id) &&
        sameDetectedMerchant(draft, other)
    )
    const canEdit =
      draft.receipt.status === 'needs_review' &&
      !!draft.evidence &&
      ['purchase', 'third_party_transfer'].includes(
        draft.evidence.transaction_type
      )
    return (
      <article
        key={id}
        data-receipt-id={id}
        className="border-border-subtle border-b py-5 last:border-b-0"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            {isReady && (
              <label className="flex size-11 shrink-0 items-center justify-center">
                <input
                  aria-label={`Seleccionar ${draft.payload.description}`}
                  type="checkbox"
                  className="text-primary size-5 shrink-0 rounded"
                  checked={draft.selected}
                  onChange={(e) =>
                    setDrafts((current) =>
                      current.map((row) =>
                        row.receipt.id === id
                          ? { ...row, selected: e.target.checked }
                          : row
                      )
                    )
                  }
                />
              </label>
            )}
            <div className="min-w-0">
              <h3 className="text-text-primary text-[15px] font-bold break-words">
                {draft.payload.description ||
                  draft.receipt.filename ||
                  'Comprobante por leer'}
              </h3>
              <p className="text-text-secondary mt-1 text-xs">
                {formatDate(draft.payload.date)} ·{' '}
                {draft.payload.card_id
                  ? cards.find((c) => c.id === draft.payload.card_id)?.name
                  : (accounts.find((a) => a.id === draft.payload.account_id)
                      ?.name ?? 'Elegí medio de pago')}
              </p>
              {expiry?.label && (
                <p
                  className={`mt-1 text-xs ${expiry.urgent ? 'text-warning font-medium' : 'text-text-tertiary'}`}
                >
                  {expiry.label}
                </p>
              )}
            </div>
          </div>
          <span className="text-text-primary shrink-0 text-sm font-bold tabular-nums">
            {draft.payload.amount > 0
              ? formatAmount(draft.payload.amount, draft.payload.currency)
              : 'Sin monto'}
          </span>
        </div>
        {canEdit && (
          <>
            <p className="text-primary mt-3 text-xs">
              {categoryOriginLabel(draft)}
            </p>
            <label className="text-text-secondary mt-2 block text-xs">
              Categoría
              <select
                aria-label="Categoría"
                className={`${field} mt-1`}
                value={draft.payload.category}
                onChange={(e) => patchPayload(id, { category: e.target.value })}
              >
                <option value="">Elegí categoría</option>
                {CATEGORIES.filter((c) => c !== 'Pago de Tarjetas').map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {!draft.decisions.categoryReviewed &&
              !isReady &&
              draft.payload.category && (
                <button
                  type="button"
                  className="text-primary mt-1 min-h-11 text-sm font-semibold"
                  onClick={() =>
                    patchPayload(id, { category: draft.payload.category })
                  }
                >
                  Usar esta categoría
                </button>
              )}
            {!!matching.length && draft.payload.category && (
              <button
                type="button"
                className="rounded-button border-border-strong text-primary mt-2 min-h-11 w-full border px-3 py-2 text-left text-xs font-medium"
                onClick={() =>
                  setDrafts((current) =>
                    current.map((row) =>
                      matching.some(
                        (other) => other.receipt.id === row.receipt.id
                      )
                        ? {
                            ...row,
                            payload: {
                              ...row.payload,
                              category: draft.payload.category,
                            },
                            decisions: {
                              ...row.decisions,
                              categoryReviewed: true,
                            },
                            categoryOrigin: 'user',
                            error: undefined,
                          }
                        : row
                    )
                  )
                }
              >
                Aplicar {draft.payload.category} a los otros {matching.length}{' '}
                de este comercio
              </button>
            )}
            {!draft.payload.account_id && !draft.payload.card_id && (
              <label className="text-text-secondary mt-3 block text-xs">
                Cuenta o tarjeta
                <select
                  className={`${field} mt-1`}
                  aria-label="Cuenta o tarjeta"
                  value=""
                  onChange={(e) => selectSource(id, e.target.value, draft)}
                >
                  {sourceOptions()}
                </select>
              </label>
            )}
            {draft.evidence?.operation_status === 'unknown' && (
              <label className="text-text-secondary mt-2 flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="text-primary size-5 shrink-0 rounded"
                  checked={draft.decisions.operationReviewed}
                  onChange={(e) =>
                    setDecision(id, 'operationReviewed', e.target.checked)
                  }
                />
                Verifiqué que la operación está completada
              </label>
            )}
            {!!draft.evidence?.warnings.length && (
              <div className="rounded-input bg-warning-soft text-warning mt-3 p-3 text-xs">
                <p>{draft.evidence.warnings.join(' · ')}</p>
                <label className="mt-1 flex min-h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0"
                    checked={draft.decisions.warningsReviewed}
                    onChange={(e) =>
                      setDecision(id, 'warningsReviewed', e.target.checked)
                    }
                  />
                  Revisé estas advertencias
                </label>
              </div>
            )}
            <MerchantMemoryFields
              id={id}
              detectedAlias={
                draft.receipt.detected_alias ??
                draft.evidence?.merchant_or_counterparty ??
                ''
              }
              category={draft.payload.category}
              memory={choice}
              profiles={profiles}
              profilesError={profilesError}
              onChange={(value) =>
                setMemory((current) => ({ ...current, [id]: value }))
              }
            />
            <details className="mt-1">
              <summary className="text-primary min-h-11 py-3 text-xs font-medium">
                Editar otros datos
              </summary>
              <div className="grid min-w-0 gap-3 pb-3 sm:grid-cols-2">
                <label className="text-text-secondary block text-xs">
                  Descripción
                  <input
                    className={`${field} mt-1`}
                    maxLength={100}
                    value={draft.payload.description}
                    onChange={(e) =>
                      patchPayload(id, { description: e.target.value })
                    }
                  />
                </label>
                <label className="text-text-secondary block text-xs">
                  Monto
                  <input
                    className={`${field} mt-1`}
                    inputMode="decimal"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={draft.payload.amount || ''}
                    onChange={(e) =>
                      patchPayload(id, { amount: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="text-text-secondary block text-xs">
                  Moneda
                  <select
                    className={`${field} mt-1`}
                    value={draft.payload.currency}
                    onChange={(e) =>
                      patchPayload(id, {
                        currency: e.target.value as 'ARS' | 'USD',
                      })
                    }
                  >
                    <option>ARS</option>
                    <option>USD</option>
                  </select>
                </label>
                <label className="text-text-secondary block text-xs">
                  Fecha
                  <input
                    className={`${field} mt-1`}
                    type="date"
                    value={draft.payload.date}
                    onChange={(e) => patchPayload(id, { date: e.target.value })}
                  />
                </label>
                <label className="text-text-secondary block text-xs">
                  Cuenta o tarjeta
                  <select
                    className={`${field} mt-1`}
                    value={
                      draft.payload.card_id
                        ? `card:${draft.payload.card_id}`
                        : (draft.payload.account_id ?? '')
                    }
                    onChange={(e) => selectSource(id, e.target.value, draft)}
                  >
                    {sourceOptions()}
                  </select>
                </label>
                {draft.payload.payment_method === 'CREDIT' && (
                  <label className="text-text-secondary block text-xs">
                    Cuotas
                    <input
                      className={`${field} mt-1`}
                      type="number"
                      min={1}
                      max={60}
                      value={draft.payload.installments}
                      onChange={(e) =>
                        patchPayload(id, {
                          installments: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                )}
                <fieldset className="flex flex-wrap gap-x-4 gap-y-1 sm:col-span-2">
                  <legend className="text-text-secondary mb-1 text-xs">
                    Etiquetas
                  </legend>
                  {(
                    [
                      ['is_want', 'Deseo'],
                      ['is_recurring', 'Recurrente'],
                      ['is_extraordinary', 'Extraordinario'],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="text-text-secondary flex min-h-11 items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        className="text-primary size-5 rounded"
                        checked={draft.payload[key] === true}
                        onChange={(e) =>
                          patchPayload(id, { [key]: e.target.checked })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </div>
            </details>
          </>
        )}
        <div className="flex flex-wrap items-center gap-x-4">
          <button
            type="button"
            className="text-primary min-h-11 text-xs font-medium"
            onClick={async () => {
              try {
                const receipt = normalizeReceiptResponse(
                  await checkedJson(
                    await fetch(SHARED_RECEIPT_ROUTES.apiDetail(id), {
                      cache: 'no-store',
                    })
                  )
                )
                setImage({ url: receipt?.image_url ?? null, id })
              } catch {
                setError('No pudimos cargar la imagen. Reintentá.')
              }
            }}
          >
            Ver comprobante
          </button>
          <Link
            className="text-primary inline-flex min-h-11 items-center text-xs font-medium"
            href={SHARED_RECEIPT_ROUTES.review(id)}
          >
            Revisión individual
          </Link>
        </div>
        {!isReady && (
          <p className="text-warning mt-1 text-xs">
            {draft.error ?? merchantMemoryError(choice) ?? reasons.join(' · ')}
          </p>
        )}
        {draft.duplicates === 'error' && (
          <button
            type="button"
            className="text-primary min-h-11 text-xs"
            onClick={() => {
              duplicateChecks.current.delete(id)
              setDrafts((current) =>
                current.map((row) =>
                  row.receipt.id === id
                    ? { ...row, duplicates: 'unchecked', error: undefined }
                    : row
                )
              )
            }}
          >
            Reintentar control de duplicados
          </button>
        )}
      </article>
    )
  }
  function setDecision(
    id: string,
    key: keyof BulkReceiptDraft['decisions'],
    value: boolean
  ) {
    setDrafts((current) =>
      current.map((row) =>
        row.receipt.id === id
          ? {
              ...row,
              error: undefined,
              decisions: { ...row.decisions, [key]: value },
            }
          : row
      )
    )
  }
  function sourceOptions() {
    return (
      <>
        <option value="">Elegí cuenta o tarjeta</option>
        <optgroup label="Cuentas">
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Tarjetas">
          {cards.map((c) => (
            <option key={c.id} value={`card:${c.id}`}>
              {c.name}
            </option>
          ))}
        </optgroup>
      </>
    )
  }
  function selectSource(id: string, value: string, draft: BulkReceiptDraft) {
    const isCard = value.startsWith('card:')
    patchPayload(id, {
      card_id: isCard ? value.slice(5) : null,
      account_id: isCard ? null : value || null,
      payment_method: isCard
        ? 'CREDIT'
        : accounts.find((a) => a.id === value)?.type === 'cash'
          ? 'CASH'
          : draft.evidence?.payment_rail === 'bank_transfer'
            ? 'TRANSFER'
            : 'DEBIT',
      installments: isCard ? draft.payload.installments : 1,
    })
  }
  return (
    <section
      className="bg-bg-primary mx-auto flex min-h-0 max-w-2xl flex-col"
      style={{ height: 'calc(100dvh - var(--tab-bar-height, 78px))' }}
      aria-label="Revisión por lote"
    >
      <BlueHeaderZone className="pt-safe px-5 pb-7 text-white">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium"
        >
          <ArrowLeft size={18} weight="light" />
          Volver
        </Link>
        <h1 className="type-title mt-2">Revisá en una tanda</h1>
        <p className="mt-2 text-sm text-white/90">
          Completá lo que falta y confirmá juntos.
        </p>
      </BlueHeaderZone>
      <div
        data-batch-scroll
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5"
      >
        {loading && (
          <p role="status" className="text-text-secondary py-6 text-sm">
            Preparando comprobantes…
          </p>
        )}
        {!loading && (
          <p className="text-text-secondary text-sm" aria-live="polite">
            {live.length} comprobantes sin confirmar
            {preparing ? ' · Leyendo los pendientes…' : ''}
          </p>
        )}
        {preparing && (
          <p className="text-text-secondary mt-1 text-xs">
            Podés editar los ya leídos. No hace falta abrir cada imagen.
          </p>
        )}
        {!loading && live.length > 0 && <p className="text-text-secondary mt-2 text-xs leading-5">Un alias exacto usa la categoría que guardaste. Una regla verificada aplica solo a comercios específicos. Las demás categorías son sugerencias y requieren tu revisión; la confianza del lector no garantiza la categoría.</p>}
        {error && (
          <p
            role="alert"
            className="rounded-input bg-danger-light text-danger mt-4 p-3 text-sm"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-input bg-success-soft text-success mt-4 p-3 text-sm"
          >
            {notice}
          </p>
        )}
        {memoryFailures.map((id) => (
          <div
            key={id}
            role="status"
            className="rounded-input bg-warning-soft text-warning mt-3 p-3 text-sm"
          >
            <p>
              El gasto de{' '}
              {memoryFailureDrafts.current.get(id)?.payload.description}{' '}
              se guardó, pero no pudimos recordar el comercio.
            </p>
            <button
              disabled={busy}
              type="button"
              className="text-primary mt-1 min-h-11 font-semibold"
              onClick={async () => {
                if (submitLock.current || busy) return
                const draft = memoryFailureDrafts.current.get(id)
                if (!draft || !memory[id]) return
                submitLock.current = true
                setBusy(true)
                setError(null)
                try {
                  if (!(await claimPendingAliasRetry(id))) {
                    setError(
                      'Otro reintento ya está en curso o el alias ya se guardó.'
                    )
                    return
                  }
                  const effective = await rememberMerchant(draft, memory[id])
                  setMemory((current) => ({ ...current, [id]: effective }))
                  memoryFailureDrafts.current.delete(id)
                  setMemoryFailures((current) =>
                    current.filter((value) => value !== id)
                  )
                } catch {
                  const pending = pendingMerchantMemoryFromDraft(
                    draft,
                    memorySnapshot.current[id] ?? memory[id]
                  )
                  if (pending) {
                    const restored = await persistPendingAliasRetry(id, pending)
                    if (!restored) {
                      setError(
                        'No pudimos recordar el comercio ni conservar el reintento. Reintentá.'
                      )
                    }
                  }
                } finally {
                  submitLock.current = false
                  setBusy(false)
                }
              }}
            >
              Reintentar solo el alias
            </button>
          </div>
        ))}
        <fieldset disabled={busy} className="min-w-0">
          {!!pending.length && (
            <section aria-label="Necesitan revisión" className="mt-7">
              <h2 className="text-base font-bold">
                Necesitan revisión: {pending.length}
              </h2>
              {pending.map((row) => renderRow(row, false))}
            </section>
          )}
          {!!ready.length && (
            <details open className="mt-7">
              <summary className="text-text-primary min-h-11 py-3 text-base font-bold">
                Listos para confirmar: {ready.length}
              </summary>
              <label className="text-text-secondary flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="text-primary size-5 rounded"
                  checked={selected.length === ready.length}
                  onChange={(e) =>
                    setDrafts((current) =>
                      current.map((row) =>
                        readyIds.has(row.receipt.id)
                          ? { ...row, selected: e.target.checked }
                          : row
                      )
                    )
                  }
                />
                Seleccionar todos los listos
              </label>
              {ready.map((row) => renderRow(row, true))}
            </details>
          )}
        </fieldset>
        {!loading && !live.length && (
          <div className="py-12 text-center">
            <CheckCircle
              className="text-success mx-auto"
              size={40}
              weight="light"
            />
            <h2 className="mt-3 text-lg font-bold">Bandeja al día</h2>
            <p className="text-text-secondary mt-2 text-sm">
              No quedan comprobantes en esta tanda.
            </p>
          </div>
        )}
        {remainingCount > 0 && (
          <p className="text-text-secondary mt-5 text-sm">
            Hay {remainingCount} comprobantes más. Terminá esta tanda para
            preparar la siguiente.
          </p>
        )}
        {!preparing && !busy && !loading && (
          <button
            type="button"
            className="text-primary my-4 min-h-11 text-sm font-semibold"
            onClick={() => {
              if (
                !live.length ||
                window.confirm(
                  'Se volverá a cargar la tanda. Las ediciones sin confirmar se perderán. ¿Continuar?'
                )
              )
                setRevision((value) => value + 1)
            }}
          >
            {live.length ? 'Actualizar estados' : 'Preparar otra tanda'}
          </button>
        )}
      </div>
      <footer className="border-border-subtle bg-bg-primary shrink-0 border-t px-5 py-4">
        <button
          type="button"
          disabled={busy || !selected.length}
          onClick={() => void confirm()}
          className="rounded-button bg-primary flex min-h-12 w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          <Receipt size={19} weight="light" />
          {busy ? 'Confirmando…' : `Confirmar los ${selected.length} listos`}
        </button>
        <p className="text-text-secondary mt-2 text-center text-xs">
          {pending.length
            ? `Los ${pending.length} por revisar quedan pendientes.`
            : 'Solo se guardan los comprobantes seleccionados.'}
        </p>
        <p className="sr-only" aria-live="polite">
          {ready.length} listos para confirmar
        </p>
      </footer>
      {image && (
        <Modal open onClose={() => setImage(null)}>
          <div>
            <h2 className="text-lg font-bold">Comprobante</h2>
            {image.url ? (
              // Private short-lived signed URLs match the existing receipt preview.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.url}
                alt="Comprobante original"
                className="mt-4 max-h-[65dvh] w-full object-contain"
              />
            ) : (
              <p className="text-text-secondary mt-4 text-sm">
                La imagen ya no está disponible.
              </p>
            )}
            <button
              type="button"
              onClick={() => setImage(null)}
              className="rounded-button bg-primary mt-4 min-h-11 w-full px-4 py-3 font-semibold text-white"
            >
              Cerrar
            </button>
          </div>
        </Modal>
      )}
      <span className="sr-only">
        Las operaciones no se guardan automáticamente.
      </span>
    </section>
  )
}
