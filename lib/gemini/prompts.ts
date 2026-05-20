import { todayAR } from '@/lib/format'

interface CreateExpensePromptOptions {
  input?: string
  hasReceiptImage?: boolean
}

export function createExpensePrompt({ input, hasReceiptImage = false }: CreateExpensePromptOptions): string {
  const today = todayAR()
  const normalizedInput = input?.trim() ?? ''
  const inputLine = normalizedInput.length > 0 ? `Input: "${normalizedInput}"` : 'Input: ""'
  const imageLine = `Imagen adjunta: ${hasReceiptImage ? 'sí' : 'no'}`

  return `Parseá este gasto en español argentino. Hoy es ${today}.

${inputLine}
${imageLine}

Categorías válidas (elegí la más apropiada):
Supermercado, Alimentos, Restaurantes, Delivery, Kiosco y Varios, Casa/Mantenimiento, Muebles y Hogar, Servicios del Hogar, Auto/Combustible, Auto/Mantenimiento, Transporte, Salud, Farmacia, Educación, Ropa e Indumentaria, Cuidado Personal, Suscripciones, Regalos, Transferencias Familiares, Entretenimiento, Mascotas, Hijos, Otros, Pago de Tarjetas

MONTO — formato y slang argentino:
- Punto como separador de miles, coma como decimal: "1.500" = 1500, "1.500,50" = 1500.5
- Punto como decimal solo si no hay coma: "1500.50" = 1500.5
- Slang: "2 lucas"=2000, "1 luca"=1000, "1 kilo"=1000, "1 palo"=1000000, "medio palo"=500000
- Sufijos: "3k"=3000, "2.5k"=2500, "15 mil"=15000, "4 M"=4000000
- "4 lucas y media" = 4500

MONEDA:
- ARS por default y si dice "$" o "pesos"
- USD si dice: USD, usd, U$D, u$d, dólares, dólar, "dls", "us$"

MEDIO DE PAGO:
- CASH (default): efectivo, cash, en mano, plata
- DEBIT: débito, "tarjeta de débito", "con débito"
- TRANSFER: transferencia, transf, "por transferencia"
- CREDIT: tarjeta, crédito, visa, master, amex, naranja, cabal, "con tarjeta"

CUOTAS:
- Detectar: "3 cuotas", "en 3", "3c", "3x", "6 cuotas sin interés", "cuotas 12"
- Si hay cuotas → installments: número entero, payment_method: "CREDIT"
- Sin mención de cuotas → installments: null

OTRAS REGLAS:
- card_id: siempre null
- is_want: true=deseo, false=necesidad, null si es "Pago de Tarjetas"
- date: ISO 8601 con -03:00, hoy si no se menciona
- Si hay imagen, usala para inferir monto, comercio, fecha y medio de pago cuando se vean razonablemente claros en el ticket o comprobante.
- Si hay imagen y tambien Input, priorizá los datos explícitos del texto del usuario cuando contradigan la imagen.
- Si la imagen no alcanza para inferir un gasto válido, respondé is_valid=false y explicá qué faltó.

Si NO es un gasto o falta información clave, respondé: {"is_valid":false,"reason":"..."}
Casos comunes:
- Falta el monto → reason: "Faltó el monto. Ej: \\"pizza 2500\\""
- No es un gasto → reason: "Eso no parece un gasto"

Si es un gasto, respondé SOLO JSON sin markdown:
{"is_valid":true,"amount":0,"currency":"ARS","category":"","description":"","is_want":false,"payment_method":"CASH","card_id":null,"installments":null,"date":""}`
}
