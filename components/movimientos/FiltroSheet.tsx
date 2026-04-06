'use client'

import { useState, useEffect } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import type { Account } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TipoFilter    = 'gasto' | 'ingreso' | 'transferencia' | 'suscripcion'
export type OrigenFilter  = 'percibido' | 'tarjeta' | 'pago_tarjeta'
export type MonedaFilter  = 'ARS' | 'USD'

export interface ActiveFilters {
  tipos:     TipoFilter[]
  origenes:  OrigenFilter[]
  cuentas:   string[]
  categorias: string[]
  monedas:   MonedaFilter[]
}

export const EMPTY_FILTERS: ActiveFilters = {
  tipos: [], origenes: [], cuentas: [], categorias: [], monedas: [],
}

export function countFilters(f: ActiveFilters): number {
  return f.tipos.length + f.origenes.length + f.cuentas.length + f.categorias.length + f.monedas.length
}

// ─── Options ──────────────────────────────────────────────────────────────────

const TIPO_OPTIONS: { value: TipoFilter; label: string }[] = [
  { value: 'gasto',         label: 'Gasto' },
  { value: 'ingreso',       label: 'Ingreso' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'suscripcion',   label: 'Suscripción' },
]

const ORIGEN_OPTIONS: { value: OrigenFilter; label: string }[] = [
  { value: 'percibido',    label: 'Percibido' },
  { value: 'tarjeta',      label: 'Tarjeta' },
  { value: 'pago_tarjeta', label: 'Pago tarjeta' },
]

const MONEDA_OPTIONS: { value: MonedaFilter; label: string }[] = [
  { value: 'ARS', label: 'ARS' },
  { value: 'USD', label: 'USD' },
]

// ─── Chip styles ──────────────────────────────────────────────────────────────

const CHIP_DEFAULT =
  'shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-medium border transition-colors bg-white/60 border-bg-secondary text-text-secondary'
const CHIP_SELECTED =
  'shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold border transition-colors bg-primary/10 border-primary text-primary'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
}

function origenVisible(tipos: TipoFilter[]): boolean {
  return tipos.length === 0 || tipos.some((t) => t === 'gasto' || t === 'suscripcion')
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open:       boolean
  onClose:    () => void
  onApply:    (f: ActiveFilters) => void
  initial:    ActiveFilters
  accounts:   Account[]
  categories: string[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FiltroSheet({ open, onClose, onApply, initial, accounts, categories }: Props) {
  const [f, setF]                     = useState<ActiveFilters>(initial)
  const [cuentasOpen, setCuentasOpen] = useState(false)
  const [catsOpen, setCatsOpen]       = useState(false)

  // Sync pending state each time the sheet opens
  useEffect(() => {
    if (open) setF(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const showOrigen = origenVisible(f.tipos)
  const total      = countFilters(f)

  const setTipos = (tipos: TipoFilter[]) =>
    setF((prev) => ({
      ...prev,
      tipos,
      origenes: origenVisible(tipos) ? prev.origenes : [],
    }))

  return (
    <Modal open={open} onClose={onClose}>
      {/* Drag handle */}
      <div className="absolute top-2.5 inset-x-0 flex justify-center pointer-events-none">
        <div className="h-1 w-10 rounded-full bg-text-disabled" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-5 mt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[16px] font-bold text-text-primary">Filtrar</h2>
          {total > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
              {total}
            </span>
          )}
        </div>
        {total > 0 && (
          <button
            onClick={() => setF(EMPTY_FILTERS)}
            className="text-[12px] font-medium text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-6 pb-20">

        {/* 1. Tipo — always expanded */}
        <div>
          <p className="type-label text-text-tertiary mb-3">Tipo</p>
          <div className="flex flex-wrap gap-2">
            {TIPO_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTipos(toggle(f.tipos, value))}
                className={f.tipos.includes(value) ? CHIP_SELECTED : CHIP_DEFAULT}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Origen — conditional */}
        {showOrigen && (
          <div>
            <p className="type-label text-text-tertiary mb-3">Origen</p>
            <div className="flex flex-wrap gap-2">
              {ORIGEN_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setF((prev) => ({ ...prev, origenes: toggle(prev.origenes, value) }))}
                  className={f.origenes.includes(value) ? CHIP_SELECTED : CHIP_DEFAULT}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. Cuenta — collapsible */}
        {accounts.length > 0 && (
          <div>
            <button
              onClick={() => setCuentasOpen((o) => !o)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <p className="type-label text-text-tertiary">Cuenta</p>
                {f.cuentas.length > 0 && (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-primary/30 bg-primary/10 px-1 text-[10px] font-bold text-primary">
                    {f.cuentas.length}
                  </span>
                )}
              </div>
              {cuentasOpen
                ? <CaretUp size={13} className="text-text-tertiary" />
                : <CaretDown size={13} className="text-text-tertiary" />}
            </button>
            {cuentasOpen && (
              <div className="flex flex-wrap gap-2 mt-3">
                {accounts.map((acc) => (
                  <button
                    key={acc.id}
                    onClick={() => setF((prev) => ({ ...prev, cuentas: toggle(prev.cuentas, acc.id) }))}
                    className={f.cuentas.includes(acc.id) ? CHIP_SELECTED : CHIP_DEFAULT}
                  >
                    {acc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. Categoría — collapsible */}
        {categories.length > 0 && (
          <div>
            <button
              onClick={() => setCatsOpen((o) => !o)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <p className="type-label text-text-tertiary">Categoría</p>
                {f.categorias.length > 0 && (
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-primary/30 bg-primary/10 px-1 text-[10px] font-bold text-primary">
                    {f.categorias.length}
                  </span>
                )}
              </div>
              {catsOpen
                ? <CaretUp size={13} className="text-text-tertiary" />
                : <CaretDown size={13} className="text-text-tertiary" />}
            </button>
            {catsOpen && (
              <div className="flex flex-wrap gap-2 mt-3">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setF((prev) => ({ ...prev, categorias: toggle(prev.categorias, cat) }))}
                    className={f.categorias.includes(cat) ? CHIP_SELECTED : CHIP_DEFAULT}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. Moneda — always expanded */}
        <div>
          <p className="type-label text-text-tertiary mb-3">Moneda</p>
          <div className="flex gap-2">
            {MONEDA_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setF((prev) => ({ ...prev, monedas: toggle(prev.monedas, value) }))}
                className={f.monedas.includes(value) ? CHIP_SELECTED : CHIP_DEFAULT}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 -mx-6 -mb-6 bg-bg-secondary px-6 pb-6 pt-4">
        <button
          onClick={() => { onApply(f); onClose() }}
          className="w-full rounded-button bg-primary py-3 text-[14px] font-semibold text-white transition-all duration-150 hover:brightness-110 active:scale-95"
        >
          Aplicar filtros
        </button>
      </div>
    </Modal>
  )
}
