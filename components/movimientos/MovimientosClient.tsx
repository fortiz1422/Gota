'use client'

import { useState, useEffect, useCallback } from 'react'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { addMonths, getCurrentMonth } from '@/lib/dates'
import { StripOperativo } from './StripOperativo'
import { MovimientosFiltros } from './MovimientosFiltros'
import { MovimientosGroupedList } from './MovimientosGroupedList'
import type { Account, Card, Expense, IncomeEntry, Transfer, YieldAccumulator } from '@/types/database'

type TypeFilter = 'all' | 'gastos' | 'ingresos' | 'tarjeta' | 'transferencias'

type ApiMovement =
  | { kind: 'expense'; data: Expense }
  | { kind: 'income'; data: IncomeEntry }
  | { kind: 'transfer'; data: Transfer }
  | { kind: 'yield'; data: YieldAccumulator & { accountName: string } }

interface ApiResponse {
  movements: ApiMovement[]
  stats: { percibidos: number; tarjeta: number; pagoTarjeta: number }
  total: number
  categories: string[]
  accounts: Account[]
  cards: Card[]
}

function formatMonthLabel(ym: string): string {
  const raw = new Date(ym + '-15').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

interface Props {
  initialMonth: string
}

export function MovimientosClient({ initialMonth }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [loadedMovements, setLoadedMovements] = useState<ApiMovement[]>([])
  const [stats, setStats] = useState<ApiResponse['stats']>({ percibidos: 0, tarjeta: 0, pagoTarjeta: 0 })
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const currentMonth = getCurrentMonth()

  const fetchMovements = useCallback(
    async (month: string, type: TypeFilter, cats: string[], pg: number, append: boolean) => {
      if (pg === 1) setIsLoading(true)
      else setIsLoadingMore(true)

      try {
        const params = new URLSearchParams({
          month,
          type,
          page: String(pg),
        })
        if (cats.length > 0) params.set('categories', cats.join(','))

        const res = await fetch(`/api/movimientos?${params}`)
        if (!res.ok) throw new Error('fetch failed')
        const data: ApiResponse = await res.json()

        setLoadedMovements((prev) => (append ? [...prev, ...data.movements] : data.movements))
        setStats(data.stats)
        setTotal(data.total)
        setCategories(data.categories)
        if (!append) {
          setAccounts(data.accounts ?? [])
          setCards(data.cards ?? [])
        }
      } catch {
        // silently fail â€” UI keeps previous state
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    []
  )

  useEffect(() => {
    setPage(1)
    fetchMovements(selectedMonth, typeFilter, categoryFilter, 1, false)
  }, [selectedMonth, typeFilter, categoryFilter, fetchMovements])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchMovements(selectedMonth, typeFilter, categoryFilter, nextPage, true)
  }

  const handleRefresh = useCallback(() => {
    setPage(1)
    fetchMovements(selectedMonth, typeFilter, categoryFilter, 1, false)
  }, [fetchMovements, selectedMonth, typeFilter, categoryFilter])

  const handlePrevMonth = () => setSelectedMonth((m) => addMonths(m, -1))
  const handleNextMonth = () => setSelectedMonth((m) => addMonths(m, 1))

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
          </div>
        </div>

        <StripOperativo
          percibidos={stats.percibidos}
          tarjeta={stats.tarjeta}
          pagoTarjeta={stats.pagoTarjeta}
        />

        <MovimientosFiltros
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          availableCategories={categories}
        />

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
    </div>
  )
}
