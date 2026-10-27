import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MovimientosFetchErrorBanner } from '@/components/movimientos/MovimientosFetchErrorBanner'
import { resolveMovimientosMainPanel } from '@/components/movimientos/movimientosListBody'

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

describe('resolveMovimientosMainPanel', () => {
  it('prioriza skeleton mientras carga', () => {
    expect(resolveMovimientosMainPanel(true, false)).toBe('skeleton')
    expect(resolveMovimientosMainPanel(true, true)).toBe('skeleton')
  })

  it('muestra error en lugar de lista cuando fetchError y no está cargando', () => {
    expect(resolveMovimientosMainPanel(false, true)).toBe('error')
  })

  it('muestra lista cuando no hay carga ni error', () => {
    expect(resolveMovimientosMainPanel(false, false)).toBe('list')
  })
})

describe('MovimientosClient UX-A (markup en fuente)', () => {
  const source = readFileSync('components/movimientos/MovimientosClient.tsx', 'utf8')

  it('usa resolveMovimientosMainPanel para el panel principal', () => {
    expect(source).toContain('resolveMovimientosMainPanel(isLoading, fetchError)')
    expect(source).toContain("mainPanel === 'error'")
  })

  it('muestra mes y año completos en el header', () => {
    expect(source).toContain('{monthPeriodLabel}')
    expect(source).not.toMatch(/formatMonthLabel\(selectedMonth\)\.split\(' '\)\[0\]/)
  })

  it('usa áreas táctiles mínimas de 44 px en nav y filtro', () => {
    expect(source).toContain('min-h-11 min-w-11')
  })

  it('etiqueta el monto filtrado con Total filtrado y moneda', () => {
    expect(source).toContain('Total filtrado ·')
    expect(source).toContain('{filteredSumCurrency}')
  })

  it('vacía movimientos y marca fetchError ante fallo de fetch (no append)', () => {
    expect(source).toContain('setLoadedMovements([])')
    expect(source).toContain('setFetchError(true)')
  })
})
