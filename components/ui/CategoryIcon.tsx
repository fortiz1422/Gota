'use client'

import {
  ShoppingCart,
  Basket,
  ForkKnife,
  Motorcycle,
  Storefront,
  Wrench,
  Armchair,
  Lightning,
  GasPump,
  Gear,
  Bus,
  Heart,
  Pill,
  BookOpen,
  TShirt,
  Sparkle,
  ArrowsClockwise,
  Gift,
  Users,
  Tag,
  CreditCard,
  Television,
  PawPrint,
  Baby,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

interface CategoryColors {
  color: string
  colorSoft: string
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized

  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)

  return `rgba(${r},${g},${b},${alpha})`
}

const CATEGORY_MAP: Record<string, { icon: Icon } & CategoryColors> = {
  'Supermercado':              { icon: ShoppingCart,    color: '#1A7A42', colorSoft: 'rgba(26,122,66,0.10)' },
  'Alimentos':                 { icon: Basket,          color: '#1A7A42', colorSoft: 'rgba(26,122,66,0.10)' },
  'Restaurantes':              { icon: ForkKnife,       color: '#2D8B5A', colorSoft: 'rgba(45,139,90,0.10)' },
  'Delivery':                  { icon: Motorcycle,      color: '#2D8B5A', colorSoft: 'rgba(45,139,90,0.10)' },
  'Kiosco y Varios':           { icon: Storefront,      color: '#3D9668', colorSoft: 'rgba(61,150,104,0.10)' },
  'Casa/Mantenimiento':        { icon: Wrench,          color: '#2178A8', colorSoft: 'rgba(33,120,168,0.10)' },
  'Muebles y Hogar':           { icon: Armchair,        color: '#2178A8', colorSoft: 'rgba(33,120,168,0.10)' },
  'Servicios del Hogar':       { icon: Lightning,       color: '#1B7E9E', colorSoft: 'rgba(27,126,158,0.10)' },
  'Auto/Combustible':          { icon: GasPump,         color: '#B84A12', colorSoft: 'rgba(184,74,18,0.10)' },
  'Auto/Mantenimiento':        { icon: Gear,            color: '#B84A12', colorSoft: 'rgba(184,74,18,0.10)' },
  'Transporte':                { icon: Bus,             color: '#C4601A', colorSoft: 'rgba(196,96,26,0.10)' },
  'Salud':                     { icon: Heart,           color: '#1B7E9E', colorSoft: 'rgba(27,126,158,0.10)' },
  'Farmacia':                  { icon: Pill,            color: '#0E8A7A', colorSoft: 'rgba(14,138,122,0.10)' },
  'Educación':                 { icon: BookOpen,        color: '#6D3DB5', colorSoft: 'rgba(109,61,181,0.10)' },
  'Ropa e Indumentaria':       { icon: TShirt,          color: '#7D4EC0', colorSoft: 'rgba(125,78,192,0.10)' },
  'Cuidado Personal':          { icon: Sparkle,         color: '#8B60C8', colorSoft: 'rgba(139,96,200,0.10)' },
  'Suscripciones':             { icon: ArrowsClockwise, color: '#2178A8', colorSoft: 'rgba(33,120,168,0.09)' },
  'Regalos':                   { icon: Gift,            color: '#A0367A', colorSoft: 'rgba(160,54,122,0.10)' },
  'Transferencias Familiares': { icon: Users,           color: '#4A6070', colorSoft: 'rgba(74,96,112,0.10)' },
  'Entretenimiento':           { icon: Television,      color: '#7D4EC0', colorSoft: 'rgba(125,78,192,0.10)' },
  'Mascotas':                  { icon: PawPrint,        color: '#AD6F0D', colorSoft: 'rgba(173,111,13,0.10)' },
  'Hijos':                     { icon: Baby,            color: '#2178A8', colorSoft: 'rgba(33,120,168,0.10)' },
  'Otros':                     { icon: Tag,             color: '#4A6070', colorSoft: 'rgba(74,96,112,0.10)' },
  'Pago de Tarjetas':          { icon: CreditCard,      color: '#A61E1E', colorSoft: 'rgba(166,30,30,0.10)' },
}

interface Props {
  category: string
  size?: number
  /** When true, wraps the icon in a 32×32 circular container */
  container?: boolean
}

export function CategoryIcon({ category, size = 16, container = false }: Props) {
  const entry = CATEGORY_MAP[category]
  if (!entry) return null

  const { icon: Icon, color, colorSoft } = entry

  if (container) {
    return (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundColor: hexToRgba(color, 0.07),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon weight="light" size={size ?? 15} style={{ color }} />
      </div>
    )
  }

  return <Icon weight="light" size={size} style={{ color }} className="shrink-0" />
}

/** Returns the color and colorSoft for a given category (for custom containers) */
export function getCategoryColors(category: string): CategoryColors {
  const entry = CATEGORY_MAP[category]
  return entry
    ? { color: entry.color, colorSoft: entry.colorSoft }
    : { color: '#4A6070', colorSoft: 'rgba(74,96,112,0.10)' }
}
