'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CaretLeft, CaretRight, Funnel, X } from '@phosphor-icons/react'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import { formatAmount } from '@/lib/format'
import { StripOperativo } from './StripOperativo'
import { MovimientosGroupedList } from './MovimientosGroupedList'
import { FiltroSheet, EMPTY_FILTERS, countFilters } from './FiltroSheet'
import type { ActiveFilters, OrigenFilter } from './FiltroSheet'
import type { Account, Card, Expense, IncomeEntry, Transfer, YieldAccumulator } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiMovement =
  | { kind: 'expense';  data: Expense }
  | { kind: 'income';   data: IncomeEntry }
  | { kind: 'transfer'; data: Transfer }
  | { kind: 'yield';    data: YieldAccumulator & { accountName: string } }

export interface ApiResponse {
  movements:           ApiMovement[]
  stats:               { percibidos: number; tarjeta: number; pagoTarjeta: number }
  total:               number
  categories:          string[]
  accounts:            Account[]
  cards:               Card[]
  filteredSum:         number
  filteredSumCurrency: 'ARS' | 'USD'
  statsCurrency:       'ARS' | 'USD'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMonthLabel(ym: string): string {
  const raw = new Date(ym + '-15').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

const TIPO_LABELS: Record<string, string> = {
  gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia', suscripcion: 'Suscripción',
}
const ORIGEN_LABELS: Record<string, string> = {
  percibido: 'Percibido', tarjeta: 'Tarjeta', pago_tarjeta: 'Pago tarjeta',
}

function buildFilterSummary(f: ActiveFilters, accounts: Account[]): string {
  const parts: string[] = []
  f.tipos.forEach((t) => parts.push(TIPO_LABELS[t] ?? t))

  f.origenes.forEach((o) => parts.push(ORIGEN_LABELS[o] ?? o))

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

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  initialMonth: string
  initialData?: ApiResponse
}

export function MovimientosClient({ initialMonth, initialData }: Props) {
  const [selectedMonth, setSelectedMonth]         = useState(initialMonth)
  const [activeFilters, setActiveFilters]         = useState<ActiveFilters>(EMPTY_FILTERS)
  const [filterOpen, setFilterOpen]               = useState(false)
  const [page, setPage]                           = useState(1)
  const [loadedMovements, setLoadedMovements]     = useState<ApiMovement[]>(initialData?.movements ?? [])
  const [stats, setStats]                         = useState<ApiResponse['stats']>(initialData?.stats ?? { percibidos: 0, tarjeta: 0, pagoTarjeta: 0 })
  const [total, setTotal]                         = useState(initialData?.total ?? 0)
  const [categories, setCategories]               = useState<string[]>(initialData?.categories ?? [])
  const [accounts, setAccounts]                   = useState<Account[]>(initialData?.accounts ?? [])
  const [cards, setCards]                         = useState<Card[]>(initialData?.cards ?? [])
  const [filteredSum, setFilteredSum]             = useState(initialData?.filteredSum ?? 0)
  const [filteredSumCurrency, setFilteredSumCurrency] = useState<'ARS' | 'USD'>(initialData?.filteredSumCurrency ?? 'ARS')
  const [statsCurrency, setStatsCurrency]         = useState<'ARS' | 'USD'>(initialData?.statsCurrency ?? 'ARS')
  const [isLoading, setIsLoading]                 = useState(!initialData)
  const [isLoadingMore, setIsLoadingMore]         = useState(false)
  const skipFirstFetch                            = useRef(!!initialData)

  const currentMonth = getCurrentMonth()

  const fetchMovements = useCallback(
    async (month: string, filters: ActiveFilters, pg: number, append: boolean) => {
      if (pg === 1) setIsLoading(true)
      else setIsLoadingMore(true)

      try {
        const params = new URLSearchParams({ month, page: String(pg) })
        if (filters.tipos.length > 0)      params.set('tipos',      filters.tipos.join(','))
        if (filters.origenes.length > 0)   params.set('origenes',   filters.origenes.join(','))
        if (filters.cuentas.length > 0)    params.set('cuentas',    filters.cuentas.join(','))
        if (filters.categorias.length > 0) params.set('categorias', filters.categorias.join(','))
        if (filters.monedas.length > 0)    params.set('monedas',    filters.monedas.join(','))
        if (filters.quincena)              params.set('quincena',   String(filters.quincena))

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
        // silently fail — UI keeps previous state
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

  // Tap a strip metric → toggle origen filter.
  const handleOrigenClick = (origen: OrigenFilter) => {
    setActiveFilters((prev) => {
      const already = prev.origenes.length === 1 && prev.origenes[0] === origen
      return { ...prev, origenes: already ? [] : [origen] }
    })
  }

  const activeCount = countFilters(activeFilters)

  // Active origen for strip visual state
  const activeOrigen: OrigenFilter | null =
    activeFilters.origenes.length === 1 ? activeFilters.origenes[0] : null

  return (
    <div className="min-h-screen bg-bg-primary">
      <div
        className="mx-auto max-w-md px-4 pt-safe"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pt-5">
          <h1 className="text-[17px] font-bold text-text-primary">Movimientos</h1>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-opacity hover:opacity-70 active:opacity-50"
              aria-label="Mes anterior"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <span className="min-w-[80px] text-center text-[13px] font-semibold text-text-primary">
              {formatMonthLabel(selectedMonth).split(' ')[0]}
            </span>
            <button
              onClick={handleNextMonth}
              disabled={selectedMonth >= addMonths(currentMonth, 2)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-opacity hover:opacity-70 active:opacity-50 disabled:opacity-30"
              aria-label="Mes siguiente"
            >
              <CaretRight size={16} weight="bold" />
            </button>

            {/* Filter button */}
            <button
              onClick={() => setFilterOpen(true)}
              className="relative ml-1 flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-opacity hover:opacity-70 active:opacity-50"
              aria-label="Filtrar movimientos"
            >
              <Funnel size={18} weight="light" />
              {activeCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-white">
                  {activeCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Strip operativo */}
        <StripOperativo
          percibidos={stats.percibidos}
          tarjeta={stats.tarjeta}
          pagoTarjeta={stats.pagoTarjeta}
          currency={statsCurrency}
          activeOrigen={activeOrigen}
          onOrigenClick={handleOrigenClick}
        />

        {/* Active filter row: chip × + total */}
        {activeCount > 0 && (
          <div className="flex items-center justify-between -mt-2 py-0.5">
            <button
              onClick={() => setActiveFilters(EMPTY_FILTERS)}
              className="flex items-center gap-1.5 glass-1 rounded-full pl-3 pr-2.5 py-1.5 min-w-0 max-w-[70%] transition-opacity active:opacity-60"
            >
              <span className="text-[12px] font-medium text-primary truncate">
                {buildFilterSummary(activeFilters, accounts)}
              </span>
              <X size={11} weight="bold" className="text-primary/60 shrink-0" />
            </button>
            {isLoading ? (
              <div className="h-3.5 w-20 rounded skeleton shrink-0" />
            ) : (
              <span className="text-[13px] font-medium text-text-secondary tabular-nums shrink-0">
                {filteredSum < 0 ? '- ' : ''}{formatAmount(Math.abs(filteredSum), filteredSumCurrency)}
              </span>
            )}
          </div>
        )}

        {/* Lista */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3.5 py-3">
                <div className="h-[38px] w-[38px] rounded-full skeleton shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-2/3 skeleton rounded" />
                  <div className="h-2.5 w-1/3 skeleton rounded" />
                </div>
                <div className="h-4 w-16 skeleton rounded" />
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
          />
        )}
      </div>

      {/* Filter sheet */}
      <FiltroSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={setActiveFilters}
        initial={activeFilters}
        accounts={accounts}
        categories={categories}
      />
    </div>
  )
}
