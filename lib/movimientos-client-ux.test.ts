// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MovimientosFetchErrorBanner } from '@/components/movimientos/MovimientosFetchErrorBanner'
import { MovimientosClient } from '@/components/movimientos/MovimientosClient'
import { readFileSync } from 'node:fs'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/components/dashboard/HomePlusButton', () => ({
  HomePlusButton: () => createElement('div', { 'data-testid': 'home-plus' }),
}))

vi.mock('@/components/ui/BlueHeaderZone', () => ({
  BlueHeaderZone: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}))

vi.mock('@/components/movimientos/StripOperativo', () => ({
  StripOperativo: () => null,
}))

vi.mock('@/components/movimientos/MovimientosGroupedList', () => ({
  MovimientosGroupedList: () => createElement('div', { 'data-testid': 'movimientos-list' }, 'Lista'),
}))

vi.mock('@/components/movimientos/FiltroSheet', () => ({
  FiltroSheet: () => null,
  EMPTY_FILTERS: {
    tipos: [],
    origenes: [],
    tarjetas: [],
    cuentas: [],
    categorias: [],
    monedas: [],
    quincena: null,
    fechaInicio: null,
    fechaFin: null,
  },
  countFilters: () => 0,
}))

const emptyApi = {
  movements: [],
  stats: { percibidos: 0, tarjeta: 0, pagoTarjeta: 0 },
  total: 0,
  categories: [] as string[],
  accounts: [],
  cards: [],
  filteredSum: 0,
  filteredSumCurrency: 'ARS' as const,
  statsCurrency: 'ARS' as const,
}

describe('MovimientosFetchErrorBanner', () => {
  it('muestra mensaje y botón Reintentar', () => {
    const html = renderToStaticMarkup(
      createElement(MovimientosFetchErrorBanner, { onRetry: () => {} })
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('No pudimos cargar los movimientos')
    expect(html).toContain('Reintentar')
  })
})

describe('MovimientosClient UX-A', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('muestra banner y no la lista cuando /api/movimientos responde !ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })

    render(createElement(MovimientosClient, { initialMonth: '2026-03' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy()
    expect(screen.queryByTestId('movimientos-list')).toBeNull()
  })

  it('muestra mes y año en el header', () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => emptyApi,
    })

    render(
      createElement(MovimientosClient, {
        initialMonth: '2026-03',
        initialData: emptyApi,
      })
    )

    expect(screen.getByText(/Marzo de 2026/i)).toBeTruthy()
  })

  it('usa áreas táctiles mínimas de 44 px en nav y filtro', () => {
    const source = readFileSync('components/movimientos/MovimientosClient.tsx', 'utf8')
    expect(source).toContain('min-h-11 min-w-11')
    expect(source).not.toMatch(/formatMonthLabel\(selectedMonth\)\.split\(' '\)\[0\]/)
  })

  it('etiqueta el monto filtrado con Total filtrado y moneda', () => {
    const source = readFileSync('components/movimientos/MovimientosClient.tsx', 'utf8')
    expect(source).toContain('Total filtrado ·')
    expect(source).toContain('{filteredSumCurrency}')
  })
})
