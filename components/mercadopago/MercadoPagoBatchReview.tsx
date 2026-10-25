'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { loadCategoryPreviews } from '@/lib/expenses/category-preview-client'
import { categoryPreviewLabel } from '@/lib/expenses/category-preview'
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
  MP_BATCH_LIMIT,
  batchBlocker,
  batchEvidence,
  buildBatchBody,
  cardEvidenceKey,
  createBatchDraft,
  applyBatchCategoryPreviews,
  submitBatch,
  type BatchDraft,
  type BatchAccountLink,
} from '@/lib/mercadopago/batch-review'
import type { Card } from '@/types/database'

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
  const [drafts, setDrafts] = useState<BatchDraft[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [link, setLink] = useState<BatchAccountLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [categoryError, setCategoryError] = useState(false)
  const commonDescriptionRef = useRef('')
  const [selected, setSelected] = useState(new Set<string>())
  const [search, setSearch] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  commonDescriptionRef.current = description
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const [notice, setNotice] = useState('')
  const busyRef = useRef(false)
  const changedRef = useRef(false)
  const summaryRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (preview) {
      summaryRef.current?.closest('[data-task-scroll]')?.scrollTo(0, 0)
      summaryRef.current?.focus({ preventScroll: true })
    }
  }, [preview])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
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
        if (!Array.isArray(loadedCards)) throw new Error('invalid_cards')
        if (!active) return
        const activeCards = loadedCards.filter((card) => !card.archived)
        setCards(activeCards)
        setLink(loadedLink)
        const initial = movements
          .filter(
            (m) =>
              getMercadoPagoReviewCapability(m).mode === 'confirmable' &&
              m.attention !== 'possible_duplicate'
          )
          .map((m) => createBatchDraft(m, activeCards))
        setDrafts(initial)
        setCategoryLoading(true)
        // Loading metadata never prevents editing. Merge only into unchanged, empty categories.
        void loadCategoryPreviews(
          initial.map((d) => d.description),
          controller.signal
        )
          .then((suggestions) => {
            if (active)
              setDrafts((current) =>
                applyBatchCategoryPreviews(current, suggestions)
              )
          })
          .catch(() => {
            if (active) setCategoryError(true)
          })
          .finally(() => {
            if (active) setCategoryLoading(false)
          })
      } catch {
        if (active) setLoadError(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void prepare()
    return () => {
      active = false
      controller.abort()
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
  const chosen = drafts.filter((d) => selected.has(d.movement.candidateId))
  const filtered = drafts.filter((d) =>
    `${d.description} ${d.movement.fundingSource?.brand ?? ''} ${d.movement.fundingSource?.lastFour ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )
  const blockers = chosen.filter((d) => batchBlocker(d, cards, link))
  const patch = (id: string, values: Partial<BatchDraft>) =>
    setDrafts((current) =>
      current.map((d) =>
        d.movement.candidateId === id
          ? {
              ...d,
              ...values,
              ...('category' in values
                ? { categoryOrigin: 'user' as const }
                : {}),
              ...('description' in values && d.categoryOrigin !== 'user'
                ? { category: '', categoryOrigin: 'none' as const }
                : {}),
            }
          : d
      )
    )
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
      blockers.length
    )
      return
    busyRef.current = true
    changedRef.current = true
    setBusy(true)
    const entries = chosen.map((d) => ({
      candidateId: d.movement.candidateId,
      body: buildBatchBody(d, link),
    }))
    try {
      const result = await submitBatch(
        entries,
        (entry) =>
          fetch(
            `/api/integrations/mercadopago/movements/${encodeURIComponent(entry.candidateId)}/confirm-expense`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(entry.body),
              signal: AbortSignal.timeout(20_000),
            }
          ),
        (id) => {
          setDrafts((current) =>
            current.filter((d) => d.movement.candidateId !== id)
          )
          setNotice('Registrando movimientos…')
        }
      )
      setNotice(
        result.stopped
          ? `${result.confirmed} registrados con respuesta confirmada. Se detuvo la tanda; ${entries.length - result.confirmed} requieren verificar su estado. Actualizá la bandeja antes de continuar: el último envío podría haberse registrado.`
          : `${result.confirmed} movimientos registrados. Los demás siguen pendientes.`
      )
    } catch {
      setNotice(
        'Se detuvo la tanda. Actualizá la bandeja para verificar su estado antes de continuar.'
      )
    } finally {
      setFinished(true)
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
      title="Completar en lote"
      eyebrow="Mercado Pago"
      description="Completá varios movimientos y revisá antes de registrarlos."
      footer={
        finished ? (
          <button
            type="button"
            onClick={close}
            className="rounded-button bg-primary min-h-11 w-full px-4 py-3 font-semibold text-white"
          >
            Actualizar bandeja
          </button>
        ) : preview ? (
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
              disabled={busy || !chosen.length || blockers.length > 0}
              onClick={() => void confirm()}
              className="rounded-button bg-primary min-h-11 flex-1 px-3 py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Registrando…' : `Registrar ${chosen.length} gastos`}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={
              loading || loadError || !chosen.length || blockers.length > 0
            }
            onClick={() => setPreview(true)}
            className="rounded-button bg-primary min-h-11 w-full px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            Revisar {chosen.length || ''} seleccionados
          </button>
        )
      }
    >
      {loading && <p role="status">Cargando tarjetas y cuenta vinculada…</p>}
      {loadError && (
        <p role="alert">
          No pudimos cargar las referencias. Cerrá y reintentá; no se registró
          ningún gasto.
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
      {categoryLoading && (
        <p role="status" className="text-text-secondary my-3 text-sm">
          Buscando categorías para los textos distintos… Podés seguir editando.
        </p>
      )}
      {categoryError && (
        <p role="status" className="text-warning my-3 text-sm">
          No pudimos completar las sugerencias. Tus cambios siguen disponibles;
          podés elegir las categorías.
        </p>
      )}
      {!loading && !loadError && !finished && (
        <>
          {!preview && (
            <>
              <p className="text-text-secondary mb-4 text-sm">
                Hasta {MP_BATCH_LIMIT} por tanda. Las transferencias,
                devoluciones y posibles duplicados se revisan individualmente
                cuando no hay evidencia suficiente. No agrupamos por importe.
              </p>
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
                      new Set(
                        filtered
                          .slice(0, MP_BATCH_LIMIT)
                          .map((d) => d.movement.candidateId)
                      )
                    )
                  }
                >
                  Seleccionar primeros{' '}
                  {Math.min(filtered.length, MP_BATCH_LIMIT)}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-primary min-h-11 px-3 text-sm"
                >
                  Limpiar selección
                </button>
              </div>
              <p role="status" className="text-text-secondary mb-3 text-sm">
                {chosen.length} seleccionados · {drafts.length} disponibles para
                completar
              </p>
              {chosen.length > 0 && (
                <fieldset className="rounded-card border-border-subtle bg-bg-secondary mb-5 space-y-3 border p-4">
                  <legend className="px-1 text-sm font-semibold">
                    Aplicar a los {chosen.length} seleccionados
                  </legend>
                  <label className="block text-sm">
                    Descripción común
                    <input
                      className={field}
                      maxLength={100}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onBlur={() => {
                        const text = description.trim()
                        if (!text || category) return
                        void loadCategoryPreviews([text])
                          .then((rows) => {
                            if (commonDescriptionRef.current.trim() === text)
                              setCategory(
                                (current) => current || rows[0]?.category || ''
                              )
                          })
                          .catch(() => setCategoryError(true))
                      }}
                      placeholder="Ej. Peaje"
                    />
                  </label>
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
                    onClick={() =>
                      setDrafts((current) =>
                        current.map((d) =>
                          selected.has(d.movement.candidateId)
                            ? {
                                ...d,
                                ...(description.trim()
                                  ? { description: description.trim() }
                                  : {}),
                                ...(category
                                  ? {
                                      category,
                                      categoryOrigin: 'user' as const,
                                    }
                                  : description.trim() &&
                                      d.description !== description.trim() &&
                                      d.categoryOrigin !== 'user'
                                    ? {
                                        category: '',
                                        categoryOrigin: 'none' as const,
                                      }
                                    : {}),
                              }
                            : d
                        )
                      )
                    }
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
                        Tarjeta {key.replace(':', ' · •••• ')} · {group.length}{' '}
                        movimientos
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
                  key={id}
                  className="rounded-card border-border-subtle bg-bg-primary border p-4"
                >
                  <label className="flex min-h-11 items-start gap-3 text-sm font-semibold">
                    {!preview && (
                      <input
                        type="checkbox"
                        className="accent-primary mt-1 size-5 shrink-0"
                        checked={checked}
                        disabled={!checked && chosen.length >= MP_BATCH_LIMIT}
                        onChange={() =>
                          setSelected((current) => {
                            const next = new Set(current)
                            if (next.has(id)) next.delete(id)
                            else if (next.size < MP_BATCH_LIMIT) next.add(id)
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
                  {checked && (
                    <p className="text-text-secondary mt-2 text-xs">
                      {categoryPreviewLabel(d.categoryOrigin ?? 'none')}
                      {(d.categoryOrigin === 'saved_alias' ||
                        d.categoryOrigin === 'suggested_alias') &&
                      d.categoryProfileName
                        ? ` · ${d.categoryProfileName}`
                        : ''}
                    </p>
                  )}
                  {checked &&
                    (preview ? (
                      <div className="mt-2 space-y-1 text-sm">
                        {d.description !==
                          getDisplayExpenseDescription(d.movement) && (
                          <p className="font-semibold">{d.description}</p>
                        )}
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
                            onBlur={() => {
                              if (
                                !d.description.trim() ||
                                d.categoryOrigin === 'user'
                              )
                                return
                              void loadCategoryPreviews([d.description])
                                .then((rows) =>
                                  setDrafts((current) =>
                                    applyBatchCategoryPreviews(current, rows)
                                  )
                                )
                                .catch(() => setCategoryError(true))
                            }}
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
