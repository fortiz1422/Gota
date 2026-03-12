'use client'

import {
  ShoppingCart,
  Basket,
  ChefHat,
  Motorcycle,
  Storefront,
  House,
  Couch,
  Plug,
  GasPump,
  Car,
  Bus,
  FirstAidKit,
  Pill,
  BookOpen,
  TShirt,
  HandHeart,
  ArrowsClockwise,
  Gift,
  Users,
  Tag,
  CreditCard,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

const CATEGORY_ICONS: Record<string, Icon> = {
  'Supermercado':              ShoppingCart,
  'Alimentos':                 Basket,
  'Restaurantes':              ChefHat,
  'Delivery':                  Motorcycle,
  'Kiosco y Varios':           Storefront,
  'Casa/Mantenimiento':        House,
  'Muebles y Hogar':           Couch,
  'Servicios del Hogar':       Plug,
  'Auto/Combustible':          GasPump,
  'Auto/Mantenimiento':        Car,
  'Transporte':                Bus,
  'Salud':                     FirstAidKit,
  'Farmacia':                  Pill,
  'Educación':                 BookOpen,
  'Ropa e Indumentaria':       TShirt,
  'Cuidado Personal':          HandHeart,
  'Suscripciones':             ArrowsClockwise,
  'Regalos':                   Gift,
  'Transferencias Familiares': Users,
  'Otros':                     Tag,
  'Pago de Tarjetas':          CreditCard,
}

interface Props {
  category: string
  size?: number
}

export function CategoryIcon({ category, size = 16 }: Props) {
  const Icon = CATEGORY_ICONS[category]
  if (!Icon) return null
  return <Icon weight="duotone" size={size} className="text-text-primary icon-duotone shrink-0" />
}
