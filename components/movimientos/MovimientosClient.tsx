'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import { formatAmount } from '@/lib/format'
import { HomePlusButton } from '@/components/dashboard/HomePlusButton'
import { StripOperativo } from './StripOperativo'
import { MovimientosGroupedList } from './MovimientosGroupedList'
import { FiltroSheet, EMPTY_FILTERS, countFilters } from './FiltroSheet'
import type { ActiveFilters, OrigenFilter } from './FiltroSheet'
import type {
  Account,
  Card,
  Expense,
  IncomeEntry,
  Transfer,
  YieldAccumulator,
} from '@/types/database'

type ApiMovement =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: IncomeEntry }
  | { kind: 'transfer'; data: Transfer }
  | { kind: 'yield'; data: YieldAccumulator & { accountName: string } }

export interface ApiResponse {
  movements: ApiMovement[]
  stats: { percibidos: number; tarjeta: number; pagoTarjeta: number }
  total: number
  categories: string[]
  accounts: Account[]
  cards: Card[]
  filteredSum: number
  filteredSumCurrency: 'ARS' | 'USD'
  statsCurrency: 'ARS' | 'USD'
}

function formatMonthLabel(ym: string): string {
  const raw = new Date(ym + '-15').toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
  })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

const TIPO_LABELS: Record<string, string> = {
  gasto: 'Gasto',
  ingreso: 'Ingreso',
  transferencia: 'Transferencia',
  suscripcion: 'Suscripción',
}

const ORIGEN_LABELS: Record<string, string> = {
  percibido: 'Percibido',
  tarjeta: 'Tarjeta',
  pago_tarjeta: 'Pago tarjeta',
}

function buildFilterSummary(f: ActiveFilters, accounts: Account[], cards: Card[]): string {
  const parts: string[] = []
  f.tipos.forEach((t) => parts.push(TIPO_LABELS[t] ?? t))
  f.origenes.forEach((o) => parts.push(ORIGEN_LABELS[o] ?? o))

  if (f.tarjetas.length === 1) {
    parts.push(cards.find((c) => c.id === f.tarjetas[0])?.name ?? 'Tarjeta')
  } else if (f.tarjetas.length > 1) {
    parts.push(`${f.tarjetas.length} tarjetas`)
  }

  if (f.cuentas.length === 1) {
    parts.push(accounts.find((a) => a.id === f.cuentas[0])?.name ?? 'Cuenta')
  } else if (f.cuentas.length > 1) {
    parts.push(`${f.cuentas.length} cuentas`)
  }

  if (f.categorias.length === 1) {
    parts.push(f.categorias[0])
  } else if (f.categorias.length > 1) {
    parts.push(`${f.categorias.length} categ.`)
  }

  f.monedas.forEach((m) => parts.push(m))
  if (f.quincena) parts.push(f.quincena === 1 ? '1ra quincena' : '2da quincena')
  return parts.join(' · ')
}

interface Props {
  initialMonth: string
  initialData?: ApiResponse
  initialCategoria?: string
  initialSoloPercibidos?: boolean
}

export function MovimientosClient({ initialMonth, initialData, initialCategoria, initialSoloPercibidos }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>(() => {
    if (!initialCategoria) return EMPTY_FILTERS
    return {
      ...EMPTY_FILTERS,
      categorias: [initialCategoria],
      origenes: initialSoloPercibidos ? ['percibido' as const] : [],
    }
  })
  const [filterOpen, setFilterOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [loadedMovements, setLoadedMovements] = useState<ApiMovement[]>(
    initialData?.movements ?? []
  )
  const [stats, setStats] = useState<ApiResponse['stats']>(
    initialData?.stats ?? { percibidos: 0, tarjeta: 0, pagoTarjeta: 0 }
  )
  const [total, setTotal] = useState(initialData?.total ?? 0)
  const [categories, setCategories] = useState<string[]>(initialData?.categories ?? [])
  const [accounts, setAccounts] = useState<Account[]>(initialData?.accounts ?? [])
  const [cards, setCards] = useState<Card[]>(initialData?.cards ?? [])
  const [filteredSum, setFilteredSum] = useState(initialData?.filteredSum ?? 0)
  const [filteredSumCurrency, setFilteredSumCurrency] = useState<'ARS' | 'USD'>(
    initialData?.filteredSumCurrency ?? 'ARS'
  )
  const [statsCurrency, setStatsCurrency] = useState<'ARS' | 'USD'>(
    initialData?.statsCurrency ?? 'ARS'
  )
  const [isLoading, setIsLoading] = useState(!initialData)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const skipFirstFetch = useRef(!!initialData)

  useEffect(() => {
    if (initialCategoria) window.scrollTo({ top: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentMonth = getCurrentMonth()

  const fetchMovements = useCallback(
    async (month: string, filters: ActiveFilters, pg: number, append: boolean) => {
      if (pg === 1) setIsLoading(true)
      else setIsLoadingMore(true)

      try {
        const params = new URLSearchParams({ month, page: String(pg) })
        if (filters.tipos.length > 0) params.set('tipos', filters.tipos.join(','))
        if (filters.origenes.length > 0) params.set('origenes', filters.origenes.join(','))
        if (filters.tarjetas.length > 0) params.set('tarjetas', filters.tarjetas.join(','))
        if (filters.cuentas.length > 0) params.set('cuentas', filters.cuentas.join(','))
        if (filters.categorias.length > 0)
          params.set('categorias', filters.categorias.join(','))
        if (filters.monedas.length > 0) params.set('monedas', filters.monedas.join(','))
        if (filters.quincena) params.set('quincena', String(filters.quincena))

        const res = await fetch(`/api/movimientos?${params}`)
        if (!res.ok) throw new Error('fetch failed')
        const data: ApiResponse = await res.json()

        setLoadedMovements((prev) => (append ? [...prev, ...data.movements] : data.movements))
        setStats(data.stats)
        setTotal(data.total)
        setCategories(data.categories)
        setFilteredSum(data.filteredSum ?? 0)
        setFilteredSumCurrency(data.filteredSumCurrency ?? 'ARS')
        setStatsCurrency(data.statsCurrency ?? 'ARS')
        if (!append) {
          setAccounts(data.accounts ?? [])
          setCards(data.cards ?? [])
        }
      } catch {
        // keep previous state on fetch failure
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false
      return
    }
    setPage(1)
    fetchMovements(selectedMonth, activeFilters, 1, false)
  }, [selectedMonth, activeFilters, fetchMovements])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchMovements(selectedMonth, activeFilters, nextPage, true)
  }

  const handleRefresh = useCallback(() => {
    setPage(1)
    fetchMovements(selectedMonth, activeFilters, 1, false)
  }, [fetchMovements, selectedMonth, activeFilters])

  const handlePrevMonth = () => setSelectedMonth((m) => addMonths(m, -1))
  const handleNextMonth = () => setSelectedMonth((m) => addMonths(m, 1))

  const handleOrigenClick = (origen: OrigenFilter) => {
    setActiveFilters((prev) => {
      const already = prev.origenes.length === 1 && prev.origenes[0] === origen
      return { ...prev, origenes: already ? [] : [origen] }
    })
  }

  const activeCount = countFilters(activeFilters)
  const activeOrigen: OrigenFilter | null =
    activeFilters.origenes.length === 1 ? activeFilters.origenes[0] : null

  return (
    <div className="min-h-screen bg-bg-primary">
      <div
        className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-safe"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}
      >
        <div className="flex items-center justify-between pt-5">
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-opacity hover:opacity-70 active:opacity-50"
              aria-label="Mes anterior"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <span className="min-w-[100px] text-center text-[15px] font-semibold text-text-primary">
              {formatMonthLabel(selectedMonth).split(' ')[0]}
            </span>
            <button
              onClick={handleNextMonth}
              disabled={selectedMonth >= addMonths(currentMonth, 2)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-primary transition-opacity hover:opacity-70 active:opacity-50 disabled:opacity-30"
              aria-label="Mes siguiente"
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </div>

          <HomePlusButton
            accounts={accounts}
            currency={statsCurrency}
            cards={cards}
            month={selectedMonth}
          />
        </div>

        <StripOperativo
          percibidos={stats.percibidos}
          tarjeta={stats.tarjeta}
          pagoTarjeta={stats.pagoTarjeta}
          currency={statsCurrency}
          activeOrigen={activeOrigen}
          onOrigenClick={handleOrigenClick}
        />

        {activeCount > 0 && (
          <div className="flex items-center justify-between py-0.5">
            <button
              onClick={() => setActiveFilters(EMPTY_FILTERS)}
              className="glass-1 flex min-w-0 max-w-[70%] items-center gap-1.5 rounded-pill py-1.5 pl-3 pr-2.5 transition-opacity active:opacity-60"
            >
              <span className="truncate text-[12px] font-medium text-primary">
                {buildFilterSummary(activeFilters, accounts, cards)}
              </span>
              <X size={11} weight="bold" className="shrink-0 text-primary/60" />
            </button>
            {isLoading ? (
              <div className="skeleton h-3.5 w-20 shrink-0 rounded" />
            ) : (
              <span className="shrink-0 text-[13px] font-medium tabular-nums text-text-secondary">
                {filteredSum < 0 ? '- ' : ''}
                {formatAmount(Math.abs(filteredSum), filteredSumCurrency)}
              </span>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <div className="skeleton h-8 w-8 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3.5 w-2/3 rounded" />
                  <div className="skeleton h-2.5 w-1/3 rounded" />
                </div>
                <div className="skeleton h-4 w-16 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <MovimientosGroupedList
            movements={loadedMovements}
            total={total}
            isLoadingMore={isLoadingMore}
            onLoadMore={handleLoadMore}
            accounts={accounts}
            cards={cards}
            onRefresh={handleRefresh}
            activeCount={activeCount}
            onOpenFilters={() => setFilterOpen(true)}
            onClearFilters={() => setActiveFilters(EMPTY_FILTERS)}
            activeFilterSummary={buildFilterSummary(activeFilters, accounts, cards)}
            showActiveFilter={activeCount > 0}
          />
        )}
      </div>

      <FiltroSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={setActiveFilters}
        initial={activeFilters}
        accounts={accounts}
        cards={cards}
        categories={categories}
      />
    </div>
  )
}
