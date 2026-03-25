import { todayAR } from '@/lib/format'

export function createExpensePrompt(input: string): string {
  const today = todayAR()

  return `Parseá este gasto en español argentino. Hoy es ${today}.

Input: "${input}"

Categorías válidas (elegí la más apropiada):
Supermercado, Alimentos, Restaurantes, Delivery, Kiosco y Varios, Casa/Mantenimiento, Muebles y Hogar, Servicios del Hogar, Auto/Combustible, Auto/Mantenimiento, Transporte, Salud, Farmacia, Educación, Ropa e Indumentaria, Cuidado Personal, Suscripciones, Regalos, Transferencias Familiares, Entretenimiento, Mascotas, Hijos, Otros, Pago de Tarjetas

Reglas:
- currency: ARS por default, USD si dice "dólares/usd"
- payment_method: CASH por default. DEBIT si dice débito, TRANSFER si dice transferencia, CREDIT si dice tarjeta/crédito/visa/master
- card_id: null por default
- is_want: true=deseo, false=necesidad, null si es "Pago de Tarjetas"
- date: ISO 8601 con -03:00, hoy si no se menciona
- Si CREDIT: card_id requerido, usá "bbva_visa" por default

Si NO es un gasto o falta información clave, respondé: {"is_valid":false,"reason":"..."}
Casos comunes:
- Falta el monto → reason: "Faltó el monto. Ej: \"pizza 2500\""
- No es un gasto → reason: "Eso no parece un gasto"

Si es un gasto, respondé SOLO JSON sin markdown:
{"is_valid":true,"amount":0,"currency":"ARS","category":"","description":"","is_want":false,"payment_method":"CASH","card_id":null,"date":""}`
}
