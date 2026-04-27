'use client'

import { useState, useEffect } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { Modal } from '@/components/ui/Modal'
import type { Account, Card } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TipoFilter    = 'gasto' | 'ingreso' | 'transferencia' | 'suscripcion'
export type OrigenFilter  = 'percibido' | 'tarjeta' | 'pago_tarjeta'
export type MonedaFilter  = 'ARS' | 'USD'

export interface ActiveFilters {
  tipos:      TipoFilter[]
  origenes:   OrigenFilter[]
  cuentas:    string[]
  tarjetas:   string[]
  categorias: string[]
  monedas:    MonedaFilter[]
  quincena:   1 | 2 | null
}

export const EMPTY_FILTERS: ActiveFilters = {
  tipos: [], origenes: [], cuentas: [], tarjetas: [], categorias: [], monedas: [], quincena: null,
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
  'shrink-0 rounded-pill px-3.5 py-1.5 text-[12px] font-medium border transition-colors bg-white/60 border-bg-secondary text-text-secondary'
const CHIP_SELECTED =
  'shrink-0 rounded-pill px-3.5 py-1.5 text-[12px] font-semibold border-[1.5px] transition-colors bg-[rgba(33,120,168,0.10)] border-[rgba(33,120,168,0.35)] text-primary'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggle<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
}

function toggleExclusive<T>(arr: T[], val: T): T[] {
  return arr.length === 1 && arr[0] === val ? [] : [val]
}

function origenVisible(tipos: TipoFilter[]): boolean {
  return tipos.length === 0 || tipos.some((t) => t === 'gasto' || t === 'suscripcion')
}

/** Origen = solo "tarjeta" seleccionado → mostrar filtro de tarjetas */
function isTarjetaMode(origenes: OrigenFilter[]): boolean {
  return origenes.length === 1 && origenes[0] === 'tarjeta'
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
  const [f, setF]                       = useState<ActiveFilters>(initial)
  const [cuentasOpen, setCuentasOpen]   = useState(false)
  const [tarjetasOpen, setTarjetasOpen] = useState(false)
  const [catsOpen, setCatsOpen]         = useState(false)

  // Sync pending state each time the sheet opens; collapse secondary sections
  useEffect(() => {
    if (open) {
      setF(initial)
      setCuentasOpen(false)
      setTarjetasOpen(false)
      setCatsOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const showOrigen   = origenVisible(f.tipos)
  const tarjetaMode  = isTarjetaMode(f.origenes)
  const total        = countFilters(f)

  const setTipos = (tipos: TipoFilter[]) =>
    setF((prev) => {
      const supportsExpenseFilters = origenVisible(tipos)
      return {
        ...prev,
        tipos,
        origenes: supportsExpenseFilters ? prev.origenes : [],
        tarjetas: supportsExpenseFilters ? prev.tarjetas : [],
        categorias: supportsExpenseFilters ? prev.categorias : [],
      }
    })

  // Al cambiar origen: si se pasa a modo tarjeta limpia cuentas (y viceversa)
  const setOrigenes = (newOrigenes: OrigenFilter[]) => {
    const willBeTarjeta = isTarjetaMode(newOrigenes)
    if (willBeTarjeta) setCuentasOpen(false)
    else setTarjetasOpen(false)
    setF((prev) => ({
      ...prev,
      origenes:  newOrigenes,
      cuentas:   willBeTarjeta ? [] : prev.cuentas,
      tarjetas:  willBeTarjeta ? prev.tarjetas : [],
    }))
  }

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

        {/* 1. Tipo */}
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

        {/* 2. Origen */}
        {showOrigen && (
          <div>
            <p className="type-label text-text-tertiary mb-3">Origen</p>
            <div className="flex flex-wrap gap-2">
              {ORIGEN_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setOrigenes(toggle(f.origenes, value))}
                  className={f.origenes.includes(value) ? CHIP_SELECTED : CHIP_DEFAULT}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3a. Tarjeta — visible solo cuando origen = "tarjeta" */}
        {tarjetaMode && cards.length > 0 && (
          <div>
            <SectionHeader
              label="Tarjeta"
              count={f.tarjetas.length}
              isOpen={tarjetasOpen}
              onToggle={() => setTarjetasOpen((o) => !o)}
            />
            {tarjetasOpen && (
              <div className="flex flex-wrap gap-2 mt-3">
                {cards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => setF((prev) => ({ ...prev, tarjetas: toggle(prev.tarjetas, card.id) }))}
                    className={f.tarjetas.includes(card.id) ? CHIP_SELECTED : CHIP_DEFAULT}
                  >
                    {card.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3b. Cuenta — visible cuando origen NO es solo "tarjeta" */}
        {!tarjetaMode && accounts.length > 0 && (
          <div>
            <SectionHeader
              label="Cuenta"
              count={f.cuentas.length}
              isOpen={cuentasOpen}
              onToggle={() => setCuentasOpen((o) => !o)}
            />
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

        {/* 4. Categoría */}
        {showOrigen && categories.length > 0 && (
          <div>
            <SectionHeader
              label="Categoría"
              count={f.categorias.length}
              isOpen={catsOpen}
              onToggle={() => setCatsOpen((o) => !o)}
            />
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

        {/* 5. Moneda */}
        <div>
          <p className="type-label text-text-tertiary mb-3">Moneda</p>
          <div className="flex gap-2">
            {MONEDA_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setF((prev) => ({ ...prev, monedas: toggleExclusive(prev.monedas, value) }))}
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
