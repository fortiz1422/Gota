'use client'

import { useState, useEffect } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import type { Account, Card } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TipoFilter   = 'gasto' | 'ingreso' | 'transferencia' | 'suscripcion'
export type OrigenFilter = 'percibido' | 'tarjeta' | 'pago_tarjeta'
export type MonedaFilter = 'ARS' | 'USD'
export type FechaFilter  = 'este_mes' | 'ultimos_7' | 'personalizado'

export interface ActiveFilters {
  tipos:      TipoFilter[]
  origenes:   OrigenFilter[]
  cuentas:    string[]
  tarjetas:   string[]
  categorias: string[]
  monedas:    MonedaFilter[]
  quincena:   1 | 2 | null
  // UI-ready; pendiente de wiring a API
  fecha:    FechaFilter | null
  montoMin: string
  montoMax: string
  ordenar:  string
}

export const EMPTY_FILTERS: ActiveFilters = {
  tipos: [], origenes: [], cuentas: [], tarjetas: [], categorias: [],
  monedas: [], quincena: null,
  fecha: null, montoMin: '', montoMax: '', ordenar: 'recientes',
}

export function countFilters(f: ActiveFilters): number {
  return (
    f.tipos.length +
    f.origenes.length +
    f.cuentas.length +
    f.tarjetas.length +
    f.categorias.length +
    f.monedas.length +
    (f.quincena ? 1 : 0)
  )
}

/** Cuenta grupos activos en filtros avanzados (excluye tipos/origenes, que maneja el filtro rápido). */
export function countAdvancedGroups(f: ActiveFilters): number {
  let n = 0
  if (f.fecha) n++
  if (f.cuentas.length + f.tarjetas.length > 0) n++
  if (f.categorias.length > 0) n++
  if (f.monedas.length > 0) n++
  if ((f.montoMin && f.montoMin.trim() !== '') || (f.montoMax && f.montoMax.trim() !== '')) n++
  if (f.quincena) n++
  return n
}

// ─── Options ──────────────────────────────────────────────────────────────────

const FECHA_OPTIONS: { value: FechaFilter; label: string }[] = [
  { value: 'este_mes',    label: 'Este mes' },
  { value: 'ultimos_7',   label: 'Últimos 7 días' },
  { value: 'personalizado', label: 'Personalizado' },
]

const TIPO_MOV_OPTIONS: { label: string; tipo: TipoFilter | null; origen: OrigenFilter | null }[] = [
  { label: 'Gastos',       tipo: 'gasto',   origen: null },
  { label: 'Ingresos',     tipo: 'ingreso', origen: null },
  { label: 'Tarjetas',     tipo: null,      origen: 'tarjeta' },
  { label: 'Pago tarjeta', tipo: null,      origen: 'pago_tarjeta' },
]

const MONEDA_OPTIONS: { value: MonedaFilter; label: string }[] = [
  { value: 'ARS', label: 'ARS' },
  { value: 'USD', label: 'USD' },
]

// ─── Chip styles ──────────────────────────────────────────────────────────────

const CHIP_DEFAULT =
  'shrink-0 rounded-pill px-3.5 py-1.5 text-[12px] font-medium border transition-colors bg-bg-primary border-[color:var(--color-border-strong)] text-text-secondary'
const CHIP_SELECTED =
  'shrink-0 rounded-pill px-3.5 py-1.5 text-[12px] font-semibold border-[1.5px] transition-colors bg-primary/10 border-primary/35 text-primary'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open:       boolean
  onClose:    () => void
  onApply:    (f: ActiveFilters) => void
  initial:    ActiveFilters
  accounts:   Account[]
  cards:      Card[]
  categories: string[]
}

// ─── Collapsible section header ───────────────────────────────────────────────

function SectionHeader({
  label, count, isOpen, onToggle,
}: { label: string; count: number; isOpen: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">
        <p className="type-label text-text-tertiary">{label}</p>
        {count > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-primary/30 bg-primary/10 px-1 text-[10px] font-bold text-primary">
            {count}
          </span>
        )}
      </div>
      {isOpen
        ? <CaretUp size={13} className="text-text-tertiary" />
        : <CaretDown size={13} className="text-text-tertiary" />}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FiltroSheet({ open, onClose, onApply, initial, accounts, cards, categories }: Props) {
  const [f, setF]                         = useState<ActiveFilters>(initial)
  const [cuentaMedioOpen, setCuentaMedioOpen] = useState(false)
  const [catsOpen, setCatsOpen]           = useState(false)

  useEffect(() => {
    if (open) {
      setF(initial)
      setCuentaMedioOpen(false)
      setCatsOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const total = countFilters(f)
  const advancedGroupTotal = countAdvancedGroups(f)

  const toggleTipoMov = (tipo: TipoFilter | null, origen: OrigenFilter | null) => {
    setF((prev) => ({
      ...prev,
      tipos:    tipo   ? toggle(prev.tipos,   tipo)   : prev.tipos,
      origenes: origen ? toggle(prev.origenes, origen) : prev.origenes,
    }))
  }

  const isTipoMovActive = (tipo: TipoFilter | null, origen: OrigenFilter | null) => {
    if (tipo)   return f.tipos.includes(tipo)
    if (origen) return f.origenes.includes(origen)
    return false
  }

  const cuentaMedioCount = f.cuentas.length + f.tarjetas.length
  const hasCuentaMedio   = accounts.length > 0 || cards.length > 0

  return (
    <Modal open={open} onClose={onClose}>
      {/* Drag handle */}
      <div className="pointer-events-none absolute inset-x-0 top-2.5 flex justify-center">
        <div className="h-1 w-10 rounded-full bg-text-disabled" />
      </div>

      {/* Header */}
      <div className="mb-5 mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-bold text-text-primary">Filtros avanzados</h2>
          {(total > 0 || advancedGroupTotal > 0) && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {advancedGroupTotal > 0 ? advancedGroupTotal : total}
            </span>
          )}
        </div>
        {total > 0 && (
          <button
            onClick={() => setF(EMPTY_FILTERS)}
            className="text-[12px] font-medium text-text-tertiary transition-colors hover:text-text-secondary"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-6 pb-20">

        {/* A. Fecha */}
        <div>
          <p className="type-label mb-3 text-text-tertiary">Fecha</p>
          <div className="flex flex-wrap gap-2">
            {FECHA_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() =>
                  setF((prev) => ({ ...prev, fecha: prev.fecha === value ? null : value }))
                }
                className={f.fecha === value ? CHIP_SELECTED : CHIP_DEFAULT}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* B. Cuenta / medio */}
        {hasCuentaMedio && (
          <div>
            <SectionHeader
              label="Cuenta / medio"
              count={cuentaMedioCount}
              isOpen={cuentaMedioOpen}
              onToggle={() => setCuentaMedioOpen((o) => !o)}
            />
            {cuentaMedioOpen && (
              <div className="mt-3 flex flex-wrap gap-2">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() =>
                      setF((prev) => ({ ...prev, cuentas: toggle(prev.cuentas, acc.id) }))
                    }
                    className={f.cuentas.includes(acc.id) ? CHIP_SELECTED : CHIP_DEFAULT}
                  >
                    {acc.name}
                  </button>
                ))}
                {cards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() =>
                      setF((prev) => ({ ...prev, tarjetas: toggle(prev.tarjetas, card.id) }))
                    }
                    className={f.tarjetas.includes(card.id) ? CHIP_SELECTED : CHIP_DEFAULT}
                  >
                    {card.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* C. Categoría */}
        {categories.length > 0 && (
          <div>
            <SectionHeader
              label="Categoría"
              count={f.categorias.length}
              isOpen={catsOpen}
              onToggle={() => setCatsOpen((o) => !o)}
            />
            {catsOpen && (
              <div className="mt-3 flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() =>
                      setF((prev) => ({ ...prev, categorias: toggle(prev.categorias, cat) }))
                    }
                    className={f.categorias.includes(cat) ? CHIP_SELECTED : CHIP_DEFAULT}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* D. Monto */}
        <div>
          <p className="type-label mb-3 text-text-tertiary">Monto</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-[11px] text-text-tertiary">Mínimo</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={f.montoMin}
                onChange={(e) => setF((prev) => ({ ...prev, montoMin: e.target.value }))}
                className="w-full rounded-input border border-[color:var(--color-border-strong)] bg-bg-primary px-3 py-2 text-[14px] text-text-primary placeholder:text-text-disabled focus:border-primary/50 focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-[11px] text-text-tertiary">Máximo</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="∞"
                value={f.montoMax}
                onChange={(e) => setF((prev) => ({ ...prev, montoMax: e.target.value }))}
                className="w-full rounded-input border border-[color:var(--color-border-strong)] bg-bg-primary px-3 py-2 text-[14px] text-text-primary placeholder:text-text-disabled focus:border-primary/50 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* E. Tipo de movimiento */}
        <div>
          <p className="type-label mb-3 text-text-tertiary">Tipo de movimiento</p>
          <div className="flex flex-wrap gap-2">
            {TIPO_MOV_OPTIONS.map(({ label, tipo, origen }) => (
              <button
                key={label}
                onClick={() => toggleTipoMov(tipo, origen)}
                className={isTipoMovActive(tipo, origen) ? CHIP_SELECTED : CHIP_DEFAULT}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Moneda */}
        <div>
          <p className="type-label mb-3 text-text-tertiary">Moneda</p>
          <div className="flex gap-2">
            {MONEDA_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() =>
                  setF((prev) => ({ ...prev, monedas: toggle(prev.monedas, value) }))
                }
                className={f.monedas.includes(value) ? CHIP_SELECTED : CHIP_DEFAULT}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* F. Ordenar por */}
        <div>
          <p className="type-label mb-3 text-text-tertiary">Ordenar por</p>
          <div className="flex gap-2">
            <button className={CHIP_SELECTED}>Más recientes</button>
          </div>
        </div>

      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 -mx-6 -mb-6 flex gap-3 bg-bg-secondary px-6 pb-6 pt-4">
        <button
          onClick={() => setF(EMPTY_FILTERS)}
          className="rounded-button border border-[color:var(--color-border-strong)] px-4 py-3 text-[14px] font-medium text-text-secondary transition-colors hover:bg-bg-tertiary active:opacity-70"
        >
          Limpiar
        </button>
        <button
          onClick={() => { onApply(f); onClose() }}
          className="flex-1 rounded-button bg-primary py-3 text-[14px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95"
        >
          Aplicar filtros
        </button>
      </div>
    </Modal>
  )
}
