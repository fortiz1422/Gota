'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { TaskSurface } from '@/components/ui/TaskSurface'
import { CATEGORIES } from '@/lib/validation/schemas'
import {
  getDisplayExpenseDescription,
  getMercadoPagoReviewCapability,
  isReviewableMercadoPagoCardPurchase,
  type MercadoPagoMovement,
} from '@/lib/mercadopago/review'
import { formatMercadoPagoObservedDate } from '@/lib/mercadopago/review-presentation'
import {
  batchBlocker,
  batchEvidence,
  buildBatchBody,
  cardEvidenceKey,
  submitBatch,
  type BatchAccountLink,
  type BatchEntry,
} from '@/lib/mercadopago/batch-review'
import type { Card } from '@/types/database'
import type { CounterpartyAliasMatch } from '@/lib/counterparty-aliases/resolve'
import {
  groupBatchDrafts,
  prepareGroupedBatchDrafts,
  type GroupedBatchDraft,
  type BatchReviewGroup,
} from '@/lib/mercadopago/grouped-review'

const field =
  'mt-1 min-h-11 w-full min-w-0 rounded-button border border-border-strong bg-bg-tertiary px-3 py-2 text-base text-text-primary'
function money(movement: MercadoPagoMovement) {
  const amount = batchEvidence(movement).amount
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: amount.currency === 'USD' ? 'USD' : 'ARS',
  }).format(Math.abs(amount.value ?? 0))
}

export function MercadoPagoBatchReview({
  movements,
  onClose,
  onChanged,
}: {
  movements: MercadoPagoMovement[]
  onClose: () => void
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<GroupedBatchDraft[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [link, setLink] = useState<BatchAccountLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState(new Set<string>())
  const [search, setSearch] = useState('')
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!busy) return
    const started = Date.now()
    setElapsed(0)
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000
    )
    return () => clearInterval(timer)
  }, [busy])
  const [finished, setFinished] = useState(false)
  const [notice, setNotice] = useState('')
  const [prepared, setPrepared] = useState<{
    key: string
    entries: BatchEntry[]
  } | null>(null)
  const [prepareError, setPrepareError] = useState(false)
  const [prepareAttempt, setPrepareAttempt] = useState(0)
  const busyRef = useRef(false)
  const changedRef = useRef(false)
  const summaryRef = useRef<HTMLParagraphElement>(null)
  const groupHeadingRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (activeGroupKey) {
      groupHeadingRef.current?.closest('[data-task-scroll]')?.scrollTo(0, 0)
      groupHeadingRef.current?.focus({ preventScroll: true })
    }
  }, [activeGroupKey])
  useEffect(() => {
    if (preview) {
      summaryRef.current?.closest('[data-task-scroll]')?.scrollTo(0, 0)
      summaryRef.current?.focus({ preventScroll: true })
    }
  }, [preview])

  useEffect(() => {
    let active = true
    async function prepare() {
      try {
        const [cardResponse, linkResponse] = await Promise.all([
          fetch('/api/cards', { cache: 'no-store' }),
          fetch('/api/integrations/mercadopago/account-link', {
            cache: 'no-store',
          }),
        ])
        if (!cardResponse.ok || !linkResponse.ok)
          throw new Error('references_unavailable')
        const loadedCards: Card[] = await cardResponse.json()
        const loadedLink: BatchAccountLink = await linkResponse.json()
        if (!Array.isArray(loadedCards)) throw new Error('invalid_references')
        if (!active) return
        const activeCards = loadedCards.filter((card) => !card.archived)
        setCards(activeCards)
        setLink(loadedLink)
        const prepared = await prepareGroupedBatchDrafts(
          movements,
          activeCards,
          async (description) => {
            const response = await fetch('/api/counterparty-aliases/resolve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ alias_value: description }),
              cache: 'no-store',
            })
            if (!response.ok) throw new Error('alias_resolution_unavailable')
            const body = (await response.json()) as {
              match?: CounterpartyAliasMatch | null
            }
            if (!('match' in body)) throw new Error('invalid_alias_response')
            return body.match ?? null
          }
        )
        if (active) setDrafts(prepared)
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void prepare()
    return () => {
      active = false
    }
  }, [movements])

  const close = () => {
    if (busyRef.current) return
    // Refresh even after an uncertain write: the server may have committed it.
    if (changedRef.current) {
      void queryClient.invalidateQueries()
      onChanged()
    }
    onClose()
  }
  const groups = useMemo(() => groupBatchDrafts(drafts), [drafts])
  const activeGroup = groups.find((group) => group.key === activeGroupKey)
  const groupDrafts = activeGroup?.drafts ?? []
  const chosen = groupDrafts.filter((d) => selected.has(d.movement.candidateId))
  const filtered = groupDrafts.filter((d) =>
    `${d.description} ${d.movement.fundingSource?.brand ?? ''} ${d.movement.fundingSource?.lastFour ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )
  const blockers = chosen.filter((d) => batchBlocker(d, cards, link))
  const preparationKey =
    activeGroupKey && chosen.length && !blockers.length
      ? JSON.stringify(
          chosen.map((d) => ({
            candidateId: d.movement.candidateId,
            body: buildBatchBody(d, link),
          }))
        )
      : ''
  const ready = prepared?.key === preparationKey && !!preparationKey
  useEffect(() => {
    setPrepared(null)
    setPrepareError(false)
    if (!preparationKey || finished) return
    const controller = new AbortController()
    const entries: BatchEntry[] = JSON.parse(preparationKey)
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          '/api/integrations/mercadopago/movements/bulk-prepare',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries }),
            signal: controller.signal,
          }
        )
        const body = await response.json()
        if (
          !response.ok ||
          body.status !== 'ready' ||
          body.count !== entries.length
        )
          throw new Error('not_ready')
        if (!controller.signal.aborted)
          setPrepared({ key: preparationKey, entries })
      } catch {
        if (!controller.signal.aborted) setPrepareError(true)
      } finally {
        clearTimeout(deadline)
      }
    }, 350)
    const deadline = setTimeout(() => {
      controller.abort()
      setPrepareError(true)
    }, 125_000)
    return () => {
      clearTimeout(timer)
      clearTimeout(deadline)
      controller.abort()
    }
  }, [preparationKey, prepareAttempt, finished])

  const individualCount = movements.filter(
    (m) =>
      m.reviewStatus === 'pending' &&
      getMercadoPagoReviewCapability(m).mode !== 'confirmable'
  ).length
  const openGroup = (group: BatchReviewGroup) => {
    setActiveGroupKey(group.key)
    setSelected(
      new Set(
        group.kind === 'uncertain'
          ? []
          : group.drafts.map((d) => d.movement.candidateId)
      )
    )
    setSearch('')
    setCategory('')
    setDescription('')
    setPreview(false)
  }
  const backToGroups = () => {
    setActiveGroupKey(null)
    setSelected(new Set())
    setPreview(false)
  }
  const patch = (id: string, values: Partial<GroupedBatchDraft>) => {
    const original = drafts.find((d) => d.movement.candidateId === id)
    const categoryChanged =
      values.category !== undefined && values.category !== original?.category
    setDrafts((current) =>
      current.map((d) =>
        d.movement.candidateId === id
          ? {
              ...d,
              ...values,
              ...(categoryChanged
                ? {
                    grouping: {
                      kind: values.category
                        ? ('category' as const)
                        : ('uncertain' as const),
                      categoryOrigin: 'user' as const,
                    },
                  }
                : {}),
            }
          : d
      )
    )
    if (categoryChanged) {
      setSelected((current) => {
        const next = new Set(current)
        next.delete(id)
        return next
      })
      setNotice(
        values.category
          ? `Movimiento trasladado al grupo ${values.category}. Sigue pendiente de revisión.`
          : 'Movimiento trasladado a A confirmar.'
      )
    }
  }
  const applyCommon = () => {
    const updated = drafts.map((d) =>
      selected.has(d.movement.candidateId)
        ? {
            ...d,
            ...(description.trim() ? { description: description.trim() } : {}),
            ...(category
              ? {
                  category,
                  grouping: {
                    kind: 'category' as const,
                    categoryOrigin: 'user' as const,
                  },
                }
              : {}),
          }
        : d
    )
    setDrafts(updated)
    if (category) {
      setActiveGroupKey(`category:${category}`)
      setCategory('')
    }
  }
  const cardGroups = [
    ...new Set(
      chosen
        .map((d) => cardEvidenceKey(d.movement))
        .filter((key): key is string => key !== null)
    ),
  ]
  const setGroupCard = (key: string, cardId: string) =>
    setDrafts((current) =>
      current.map((d) =>
        selected.has(d.movement.candidateId) &&
        cardEvidenceKey(d.movement) === key
          ? { ...d, cardId }
          : d
      )
    )
  const confirm = async () => {
    if (
      busyRef.current ||
      finished ||
      !preview ||
      !chosen.length ||
      blockers.length ||
      !ready
    )
      return
    busyRef.current = true
    changedRef.current = true
    setBusy(true)
    const entries = prepared!.entries
    let mustRefresh = false
    const confirmedIds = new Set<string>()
    try {
      const result = await submitBatch(
        entries,
        (entries, signal) =>
          fetch('/api/integrations/mercadopago/movements/bulk-confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entries }),
            signal,
          }),
        (id) => {
          confirmedIds.add(id)
        }
      )
      mustRefresh = result.stopped
      if (!result.stopped) backToGroups()
      setNotice(
        result.stopped
          ? `${result.confirmed} registrados con respuesta confirmada. Se detuvo la tanda; ${entries.length - result.confirmed} requieren verificar su estado. Actualizá la bandeja antes de continuar: el último envío podría haberse registrado.`
          : `${result.confirmed} movimientos registrados. Los demás siguen pendientes.`
      )
    } catch {
      mustRefresh = true
      setNotice(
        'Se detuvo la tanda. Actualizá la bandeja para verificar su estado antes de continuar.'
      )
    } finally {
      setDrafts((current) =>
        current.filter((d) => !confirmedIds.has(d.movement.candidateId))
      )
      if (confirmedIds.size) void queryClient.invalidateQueries()
      setFinished(mustRefresh)
      setBusy(false)
      busyRef.current = false
    }
  }

  return (
    <TaskSurface
      open
      onClose={close}
      busy={busy}
      variant="blue-hero"
      showIntro={!activeGroupKey}
      title={activeGroup ? activeGroup.title : 'Revisar por grupos'}
      eyebrow="Mercado Pago"
      description={
        activeGroup
          ? 'Revisá los movimientos y quitá los que quieras dejar pendientes.'
          : 'Primero tus alias, después las categorías sugeridas. Lo incierto queda a confirmar.'
      }
      footer={
        finished ? (
          <button
            type="button"
            onClick={close}
            className="rounded-button bg-primary min-h-11 w-full px-4 py-3 font-semibold text-white"
          >
            Actualizar bandeja
          </button>
        ) : !activeGroupKey ? (
          <button
            type="button"
            onClick={close}
            className="rounded-button border-border-strong min-h-11 w-full border px-4 py-3 font-semibold"
          >
            Cerrar revisión
          </button>
        ) : preview ? (
          <div>
            {busy && (
              <p
                role="status"
                className="text-text-secondary mb-2 text-center text-sm"
              >
                Procesando el lote completo · {elapsed} s
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreview(false)}
                disabled={busy}
                className="rounded-button border-border-strong min-h-11 border px-3 text-sm"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={
                  busy || !ready || !chosen.length || blockers.length > 0
                }
                onClick={() => void confirm()}
                className="rounded-button bg-primary min-h-11 flex-1 px-3 py-3 font-semibold text-white disabled:opacity-50"
              >
                {busy
                  ? `Guardando lote de ${chosen.length} gastos…`
                  : `Registrar ${chosen.length} gastos`}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={
              loading ||
              loadError ||
              !ready ||
              !chosen.length ||
              blockers.length > 0
            }
            onClick={() => setPreview(true)}
            className="rounded-button bg-primary min-h-11 w-full px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {preparationKey && !ready
              ? prepareError
                ? 'No se pudo preparar el lote'
                : 'Preparando lote…'
              : chosen.length
                ? `Revisar ${chosen.length} seleccionados`
                : 'Elegí movimientos'}
          </button>
        )
      }
    >
      {loading && (
        <p role="status">Cargando alias, tarjetas y cuenta vinculada…</p>
      )}
      {loadError && (
        <p role="alert">
          No pudimos cargar las referencias. Cerrá y reintentá; no se registró
          ningún gasto.
        </p>
      )}
      {prepareError && !finished && (
        <p role="alert">
          No pudimos preparar el lote. No se registró ningún gasto.{' '}
          <button type="button" onClick={() => setPrepareAttempt((n) => n + 1)}>
            Reintentar preparación
          </button>
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-input bg-primary-soft text-text-primary my-3 p-3 text-sm"
        >
          {notice}
        </p>
      )}
      {!loading && !loadError && !finished && (
        <>
          {!activeGroupKey && (
            <>
              <p className="text-text-secondary mb-4 text-sm">
                {drafts.length} pendientes para completar en esta bandeja.
                Ninguno se registra hasta que confirmes su grupo.
              </p>
              <div className="divide-border-subtle divide-y">
                {groups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => openGroup(group)}
                    className="min-h-11 w-full py-4 text-left"
                    aria-label={`Revisar ${group.title}, ${group.drafts.length} movimientos`}
                  >
                    <span className="text-text-secondary block text-xs">
                      {group.kind === 'alias'
                        ? 'Alias guardado'
                        : group.kind === 'category'
                          ? group.drafts.every(
                              (d) => d.grouping.categoryOrigin === 'user'
                            )
                            ? 'Categoría elegida'
                            : 'Categoría sugerida'
                          : 'Revisión manual'}
                    </span>
                    <span className="mt-1 flex items-baseline justify-between gap-3">
                      <span className="text-base font-semibold">
                        {group.title}
                      </span>
                      <span className="text-text-secondary shrink-0 text-sm">
                        {group.drafts.length} movimientos
                      </span>
                    </span>
                    {group.kind === 'alias' && (
                      <span className="text-text-secondary block text-sm">
                        {group.drafts[0].category || 'Falta elegir categoría'}
                      </span>
                    )}
                    <span className="mt-1 block text-sm tabular-nums">
                      {group.totals
                        .map(
                          (total) =>
                            `${total.currency} ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total.value)}`
                        )
                        .join(' · ')}
                    </span>
                    {group.dates.length > 0 && (
                      <span className="text-text-secondary block text-xs">
                        {formatMercadoPagoObservedDate(group.dates[0])} —{' '}
                        {formatMercadoPagoObservedDate(
                          group.dates[group.dates.length - 1]
                        )}
                      </span>
                    )}
                    <span className="text-primary mt-2 block text-sm font-semibold">
                      Revisar grupo
                    </span>
                  </button>
                ))}
              </div>
              {individualCount > 0 && (
                <p className="text-warning mt-4 text-sm">
                  {individualCount} movimientos requieren revisión individual
                  por evidencia incompleta o posibles duplicados. Siguen en la
                  bandeja.
                </p>
              )}
            </>
          )}
          {activeGroupKey && !preview && (
            <>
              <section ref={groupHeadingRef} tabIndex={-1} className="mb-3">
                <button
                  type="button"
                  onClick={backToGroups}
                  className="text-primary min-h-11 text-sm font-semibold"
                >
                  Volver a los grupos
                </button>
                <p className="text-sm font-semibold">
                  {activeGroup?.drafts[0]?.category || 'Categoría pendiente'}
                </p>
                <p role="status" className="text-text-secondary text-sm">
                  {chosen.length} seleccionados · {groupDrafts.length} en este
                  grupo
                </p>
                {activeGroup?.kind === 'uncertain' && (
                  <p className="text-text-secondary mt-2 text-sm">
                    Elegí los movimientos que quieras completar.
                  </p>
                )}
              </section>
              <details className="mb-2">
                <summary className="text-primary min-h-11 cursor-pointer py-3 text-sm">
                  Buscar o cambiar selección
                </summary>
                <label className="block text-sm font-medium">
                  Buscar descripción o tarjeta
                  <input
                    className={field}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ej. TelePASE o 8215"
                  />
                </label>
                <div className="my-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-button border-border-strong min-h-11 border px-3 text-sm"
                    onClick={() =>
                      setSelected(
                        new Set(filtered.map((d) => d.movement.candidateId))
                      )
                    }
                  >
                    Seleccionar {filtered.length} visibles
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="text-primary min-h-11 px-3 text-sm"
                  >
                    Limpiar selección
                  </button>
                </div>
              </details>
              {chosen.length > 0 && (
                <details open={blockers.length > 0} className="mb-5">
                  <summary className="text-primary min-h-11 cursor-pointer py-3 text-sm font-semibold">
                    Completar o editar seleccionados
                  </summary>
                  <fieldset className="rounded-card border-border-subtle bg-bg-secondary mb-5 space-y-3 border p-4">
                    <legend className="px-1 text-sm font-semibold">
                      Aplicar a los {chosen.length} seleccionados
                    </legend>
                    <details>
                      <summary className="text-primary min-h-11 cursor-pointer py-3 text-sm">
                        Editar descripción en lote (opcional)
                      </summary>
                      <label className="block text-sm">
                        Descripción común
                        <input
                          className={field}
                          maxLength={100}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Ej. Peaje"
                        />
                      </label>
                    </details>
                    <label className="block text-sm">
                      Categoría común
                      <select
                        className={field}
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="">Elegí una categoría</option>
                        {CATEGORIES.filter(
                          (c) =>
                            c !== 'Pago de Tarjetas' ||
                            !chosen.some((d) =>
                              isReviewableMercadoPagoCardPurchase(d.movement)
                            )
                        ).map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={!description.trim() && !category}
                      className="rounded-button border-primary text-primary min-h-11 w-full border px-3 text-sm font-semibold disabled:opacity-50"
                      onClick={applyCommon}
                    >
                      Aplicar descripción / categoría
                    </button>
                    <p className="text-text-secondary text-xs">
                      Solo cambia los campos que completaste. No crea una regla
                      para próximas importaciones.
                    </p>
                    {cardGroups.map((key) => {
                      const group = chosen.filter(
                        (d) => cardEvidenceKey(d.movement) === key
                      )
                      const common = group.every(
                        (d) => d.cardId === group[0].cardId
                      )
                        ? group[0].cardId
                        : ''
                      return (
                        <label key={key} className="block text-sm">
                          Tarjeta {key.replace(':', ' · •••• ')} ·{' '}
                          {group.length} movimientos
                          <select
                            className={field}
                            value={common}
                            onChange={(e) => setGroupCard(key, e.target.value)}
                          >
                            <option value="">Elegí una tarjeta</option>
                            {cards.map((card) => (
                              <option key={card.id} value={card.id}>
                                {card.name}
                                {card.last_four ? ` · ${card.last_four}` : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                      )
                    })}
                    {chosen.some(
                      (d) => !isReviewableMercadoPagoCardPurchase(d.movement)
                    ) && (
                      <p className="text-text-secondary text-sm">
                        Saldo MP:{' '}
                        {link?.linkedAccountId ? (
                          'se usará la cuenta vinculada'
                        ) : (
                          <Link
                            href="/settings"
                            className="text-primary underline"
                          >
                            vinculá una cuenta en Configuración
                          </Link>
                        )}
                        .
                      </p>
                    )}
                  </fieldset>
                </details>
              )}
            </>
          )}
          {preview && (
            <p
              ref={summaryRef}
              tabIndex={-1}
              className="text-text-secondary mb-4 text-sm"
            >
              Vas a registrar {chosen.length} gastos con estos datos. Se
              conservan los importes, monedas, fechas y cuotas de MP. Revisá que
              sean consumos y que no estén cargados por otra vía.
            </p>
          )}
          <div className="space-y-3">
            {(preview ? chosen : filtered).map((d) => {
              const id = d.movement.candidateId
              const checked = selected.has(id)
              const blocker = checked ? batchBlocker(d, cards, link) : null
              return (
                <article
                  data-mp-review-row
                  key={id}
                  className="rounded-card border-border-subtle bg-bg-primary border p-4"
                >
                  <label className="flex min-h-11 items-start gap-3 text-sm font-semibold">
                    {!preview && (
                      <input
                        type="checkbox"
                        className="accent-primary mt-1 size-5 shrink-0"
                        checked={checked}
                        onChange={() =>
                          setSelected((current) => {
                            const next = new Set(current)
                            if (next.has(id)) next.delete(id)
                            else next.add(id)
                            return next
                          })
                        }
                        aria-label={`Seleccionar ${getDisplayExpenseDescription(d.movement) || 'sin descripción'} ${formatMercadoPagoObservedDate(batchEvidence(d.movement).date)}`}
                      />
                    )}
                    <span className="min-w-0 break-words">
                      {getDisplayExpenseDescription(d.movement) ||
                        'Comercio no informado'}
                      <span className="text-text-secondary mt-1 block text-xs font-normal">
                        {money(d.movement)} ·{' '}
                        {formatMercadoPagoObservedDate(
                          batchEvidence(d.movement).date
                        )}
                      </span>
                      <span className="text-text-secondary block text-xs font-normal">
                        {isReviewableMercadoPagoCardPurchase(d.movement)
                          ? `${d.movement.fundingSource?.brand || 'Tarjeta'} · ${d.movement.fundingSource?.lastFour || 'sin terminación'} · ${d.movement.installments} cuota(s)`
                          : 'Saldo MP'}
                      </span>
                    </span>
                  </label>
                  {d.grouping.reason && (
                    <p className="text-warning mt-2 text-sm">
                      {d.grouping.reason}
                    </p>
                  )}
                  {checked &&
                    (preview ? (
                      <div className="mt-2 space-y-1 text-sm">
                        <p className="font-semibold">{d.description}</p>
                        <p>
                          {d.category} ·{' '}
                          {isReviewableMercadoPagoCardPurchase(d.movement)
                            ? cards.find((c) => c.id === d.cardId)?.name
                            : 'Cuenta vinculada de MP'}
                        </p>
                        <p className="text-text-secondary">
                          {d.isWant ? 'Deseo' : 'Necesidad'}
                          {d.isRecurring ? ' · Recurrente' : ''}
                          {d.isExtraordinary ? ' · Extraordinario' : ''}
                        </p>
                      </div>
                    ) : (
                      <details className="mt-2 space-y-3">
                        <summary className="text-primary min-h-11 cursor-pointer py-3 text-sm">
                          {blocker ?? `${d.description} · ${d.category}`} ·
                          Editar
                        </summary>
                        <label className="block text-sm">
                          Descripción
                          <input
                            className={field}
                            maxLength={100}
                            value={d.description}
                            onChange={(e) =>
                              patch(id, { description: e.target.value })
                            }
                          />
                        </label>
                        <label className="block text-sm">
                          Categoría
                          <select
                            className={field}
                            value={d.category}
                            onChange={(e) =>
                              patch(id, { category: e.target.value })
                            }
                          >
                            <option value="">Elegí una categoría</option>
                            {CATEGORIES.filter(
                              (c) =>
                                c !== 'Pago de Tarjetas' ||
                                !isReviewableMercadoPagoCardPurchase(d.movement)
                            ).map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                        {isReviewableMercadoPagoCardPurchase(d.movement) && (
                          <label className="block text-sm">
                            Tarjeta
                            <select
                              className={field}
                              value={d.cardId}
                              onChange={(e) =>
                                patch(id, { cardId: e.target.value })
                              }
                            >
                              <option value="">Elegí una tarjeta</option>
                              {cards.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <div className="flex flex-wrap gap-x-4">
                          {(
                            [
                              ['isWant', 'Deseo'],
                              ['isRecurring', 'Recurrente'],
                              ['isExtraordinary', 'Extraordinario'],
                            ] as const
                          ).map(([key, label]) => (
                            <label
                              key={key}
                              className="flex min-h-11 items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                className="accent-primary size-5"
                                checked={d[key]}
                                onChange={(e) =>
                                  patch(id, { [key]: e.target.checked })
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        {blocker && (
                          <p className="text-warning text-sm">{blocker}</p>
                        )}
                      </details>
                    ))}
                </article>
              )
            })}
          </div>
          {blockers.length > 0 && (
            <p role="status" className="text-warning mt-4 text-sm">
              Falta completar {blockers.length} de los seleccionados.
            </p>
          )}
          {!drafts.length && (
            <p>
              No hay movimientos aptos para este lote. Revisá las excepciones
              individualmente.
            </p>
          )}
        </>
      )}
    </TaskSurface>
  )
}
