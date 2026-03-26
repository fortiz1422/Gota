import { z } from 'zod'

export const CATEGORIES = [
  'Supermercado',
  'Alimentos',
  'Restaurantes',
  'Delivery',
  'Kiosco y Varios',
  'Casa/Mantenimiento',
  'Muebles y Hogar',
  'Servicios del Hogar',
  'Auto/Combustible',
  'Auto/Mantenimiento',
  'Transporte',
  'Salud',
  'Farmacia',
  'Educación',
  'Ropa e Indumentaria',
  'Cuidado Personal',
  'Suscripciones',
  'Regalos',
  'Transferencias Familiares',
  'Entretenimiento',
  'Mascotas',
  'Hijos',
  'Otros',
  'Pago de Tarjetas',
] as const

export type Category = (typeof CATEGORIES)[number]

export const ExpenseSchema = z
  .object({
    amount: z.number().min(1, 'El monto debe ser mayor a 0'),
    currency: z.enum(['ARS', 'USD']),
    category: z.string().min(1, 'Categoría requerida'),
    description: z.string().max(100, 'Máximo 100 caracteres'),
    is_want: z.boolean().nullable(),
    payment_method: z.enum(['CASH', 'DEBIT', 'TRANSFER', 'CREDIT']),
    card_id: z.string().nullable(),
    date: z.string(),
    installments: z.number().int().min(1).max(72).nullish(),
    installment_start: z.number().int().min(1).optional(),
    installment_grand_total: z.number().int().min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.payment_method === 'CREDIT' && !data.card_id) return false
      if (data.category === 'Pago de Tarjetas' && !data.card_id) return false
      return true
    },
    { message: 'Tarjeta requerida para pagos con crédito o Pago de Tarjetas' }
  )

export type ExpenseInput = z.infer<typeof ExpenseSchema>

export const ParsedExpenseSchema = z.union([
  z.object({
    is_valid: z.literal(true),
    amount: z.number().min(1),
    currency: z.enum(['ARS', 'USD']),
    category: z.string(),
    description: z.string(),
    is_want: z.boolean().nullable(),
    payment_method: z.enum(['CASH', 'DEBIT', 'TRANSFER', 'CREDIT']),
    card_id: z.string().nullable(),
    installments: z.number().int().min(1).nullable().optional(),
    date: z.string(),
  }),
  z.object({
    is_valid: z.literal(false),
    reason: z.string(),
  }),
])

export type ParsedExpense = z.infer<typeof ParsedExpenseSchema>
