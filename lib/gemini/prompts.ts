import { todayAR } from '@/lib/format'

interface CreateExpensePromptOptions {
  input?: string
  hasReceiptImage?: boolean
  hasVoiceAudio?: boolean
}

export function createExpensePrompt({
  input,
  hasReceiptImage = false,
  hasVoiceAudio = false,
}: CreateExpensePromptOptions): string {
  const today = todayAR()
  const normalizedInput = input?.trim() ?? ''
  const inputLine = normalizedInput.length > 0 ? `Input: "${normalizedInput}"` : 'Input: ""'
  const imageLine = `Imagen adjunta: ${hasReceiptImage ? 'si' : 'no'}`
  const audioLine = `Audio adjunto: ${hasVoiceAudio ? 'si' : 'no'}`

  return `Parsea este gasto en espanol argentino. Hoy es ${today}.

${inputLine}
${imageLine}
${audioLine}

Categorias validas (elegi la mas apropiada):
Supermercado, Alimentos, Restaurantes, Delivery, Kiosco y Varios, Casa/Mantenimiento, Muebles y Hogar, Servicios del Hogar, Auto/Combustible, Auto/Mantenimiento, Transporte, Salud, Farmacia, Educacion, Ropa e Indumentaria, Cuidado Personal, Suscripciones, Regalos, Transferencias Familiares, Entretenimiento, Vacaciones, Mascotas, Hijos, Otros, Pago de Tarjetas

MONTO - formato y slang argentino:
- Punto como separador de miles, coma como decimal: "1.500" = 1500, "1.500,50" = 1500.5
- Punto como decimal solo si no hay coma: "1500.50" = 1500.5
- Slang: "2 lucas"=2000, "1 luca"=1000, "1 kilo"=1000, "1 palo"=1000000, "medio palo"=500000
- Sufijos: "3k"=3000, "2.5k"=2500, "15 mil"=15000, "4 M"=4000000
- "4 lucas y media" = 4500
- Si el input termina con un numero standalone (ej: "Farmacia 4995"), ese numero es el monto y NO debe quedar repetido en description

MONEDA:
- ARS por default y si dice "$" o "pesos"
- USD si dice: USD, usd, U$D, u$d, dolares, dolar, "dls", "us$"

MEDIO DE PAGO:
- CASH (default): efectivo, cash, en mano, plata
- DEBIT: debito, "tarjeta de debito", "con debito"
- TRANSFER: transferencia, transf, "por transferencia"
- CREDIT: tarjeta, credito, visa, master, amex, naranja, cabal, "con tarjeta"

CUOTAS:
- Detectar: "3 cuotas", "en 3", "3c", "3x", "6 cuotas sin interes", "cuotas 12"
- Si hay cuotas -> installments: numero entero, payment_method: "CREDIT"
- Sin mencion de cuotas -> installments: null

OTRAS REGLAS:
- card_id: siempre null
- is_want: true=deseo, false=necesidad, null si es "Pago de Tarjetas"
- date: ISO 8601 con -03:00, hoy si no se menciona
- Si hay audio, interpretalo como un usuario dictando un gasto personal en espanol argentino.
- Si hay audio y tambien Input, trata el Input como aclaracion o correccion explicita del usuario.
- Si el audio no describe un gasto valido, responde is_valid=false y explica que falto.
- Si hay imagen, usala para inferir monto, comercio, fecha y medio de pago cuando se vean razonablemente claros en el ticket o comprobante.
- Si hay imagen y tambien Input, prioriza los datos explicitos del texto del usuario cuando contradigan la imagen.
- Si la imagen no alcanza para inferir un gasto valido, responde is_valid=false y explica que falto.

Si NO es un gasto o falta informacion clave, responde: {"is_valid":false,"reason":"..."}
Casos comunes:
- Falta el monto -> reason: "Falto el monto. Ej: \\\"pizza 2500\\\""
- No es un gasto -> reason: "Eso no parece un gasto"

Si es un gasto, responde SOLO JSON sin markdown:
{"is_valid":true,"amount":0,"currency":"ARS","category":"","description":"","is_want":false,"payment_method":"CASH","card_id":null,"installments":null,"date":""}`
}
