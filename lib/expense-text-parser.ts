import type { ParsedExpense } from '@/lib/validation/schemas'

type Options = { defaultCurrency?: 'ARS' | 'USD' }
const invalid = (reason: string): ParsedExpense => ({ is_valid: false, reason })
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const CATEGORIES: Array<[string, RegExp]> = [
  ['Supermercado', /\b(super|supermercado|carrefour|coto|dia|jumbo)\b/],
  ['Alimentos', /\b(panaderia|verduleria|carniceria|almacen|pan|verduras)\b/],
  ['Restaurantes', /\b(cafe|bar|resto|restaurante?|almuerzo|cena)\b/],
  ['Delivery', /\b(delivery|rappi|pedidosya)\b/],
  ['Transporte', /\b(uber|cabify|taxi|sube|bondi|tren|transporte)\b/],
  ['Auto/Combustible', /\b(nafta|combustible|ypf|shell|axion)\b/],
  ['Auto/Mantenimiento', /\b(cubiertas|mecanico|frenos|service)\b/],
  ['Farmacia', /\b(farmacia|farmacity|medicamento)\b/],
  ['Salud', /\b(medico|dentista|psicologa?|consulta medica)\b/],
  ['Suscripciones', /\b(netflix|spotify|suscripcion)\b/],
  ['Entretenimiento', /\b(amazon|cine|steam|juego)\b/],
  ['Servicios del Hogar', /\b(luz|gas|agua|internet|fibertel|edenor|edesur)\b/],
  ['Casa/Mantenimiento', /\b(ferreteria|plomero|electricista|pintura)\b/],
  ['Mascotas', /\b(veterinaria|veterinario|alimento para (perro|gato))\b/],
  ['Educación', /\b(jardin|colegio|escuela|curso)\b/],
  ['Ropa e Indumentaria', /\b(ropa|zapatillas|remera|pantalon)\b/],
]

/** Returns a proposal, never a ledger write. Ambiguities require clarification. */
export function parseTextExpenseFallback(
  input: string,
  today: string,
  options: Options = {}
): ParsedExpense {
  if (input.length > 500)
    return invalid('Usá una frase de hasta 500 caracteres.')
  let text = normalize(input.trim())
  if (
    /\b(cobre|cobro|ingreso|sueldo|me (pagaron|transfirieron)|devolucion|reintegro|reembolso)\b/.test(
      text
    )
  ) {
    return invalid('Esto parece un ingreso. Cargalo desde la opción Ingreso.')
  }
  if (
    /\b(pague|pago|pagar)\s+(la\s+)?(tarjeta|visa|mastercard|resumen)\b|\b(entre mis cuentas|a mi (cuenta|billetera))\b/.test(
      text
    )
  ) {
    return invalid(
      'Esto parece un pago de tarjeta o una transferencia entre tus cuentas. Usá la opción correspondiente para no duplicar gastos.'
    )
  }
  if (/\b(no|nunca|cancelado|cancelada)\b/.test(text))
    return invalid(
      'No queda claro si hubo un gasto. Escribí solo el movimiento que querés registrar.'
    )

  // Dates are resolved before numbers so a day cannot become an amount.
  let date = today
  const base = new Date(`${today}T12:00:00Z`)
  if (!Number.isFinite(base.getTime()))
    return invalid('No pude resolver la fecha. Revisala antes de continuar.')
  const relative = [...text.matchAll(/\b(hoy|ayer|anteayer)\b/g)]
  const explicit = [...text.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g)]
  if (relative.length + explicit.length > 1)
    return invalid('Hay más de una fecha. Registrá un movimiento por vez.')
  if (relative.length) {
    base.setUTCDate(
      base.getUTCDate() -
        ({ hoy: 0, ayer: 1, anteayer: 2 }[relative[0][1]] ?? 0)
    )
    date = base.toISOString().slice(0, 10)
    text = text.replace(relative[0][0], ' ')
  }
  if (explicit.length) {
    const [raw, day, month, year] = explicit[0]
    const candidate = `${year ?? today.slice(0, 4)}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    const parsed = new Date(`${candidate}T12:00:00Z`)
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== candidate
    )
      return invalid('Esa fecha no existe. Revisá el día y el mes.')
    date = candidate
    text = text.replace(raw, ' ')
  }
  if (
    /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|semana|mes pasado|manana)\b|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}/.test(
      text
    )
  ) {
    return invalid('Para la fecha usá hoy, ayer, anteayer o día/mes/año.')
  }

  const installmentMatches = [
    ...text.matchAll(/\b(?:en\s+)?(\d{1,2})\s+cuotas?\b/g),
  ]
  if (installmentMatches.length > 1)
    return invalid('Hay más de una cantidad de cuotas. Revisá la frase.')
  const installments = installmentMatches.length
    ? Number(installmentMatches[0][1])
    : null
  if (installments !== null && (installments < 1 || installments > 72))
    return invalid('Las cuotas deben estar entre 1 y 72.')
  if (installmentMatches.length)
    text = text.replace(installmentMatches[0][0], ' ')
  if (/\b(cuotas?|cada una|por mes)\b/.test(text))
    return invalid(
      'Escribí el precio total y la cantidad: “heladera 600 mil en 6 cuotas”.'
    )

  const usd = /(?:\b(?:usd|dolares)\b|u\$[sd])/i.test(text)
  const ars = /\b(?:ars|pesos)\b/.test(text)
  if (usd && ars)
    return invalid('Hay dos monedas. Registrá un movimiento por moneda.')
  const currency = usd
    ? 'USD'
    : ars || text.includes('$')
      ? 'ARS'
      : (options.defaultCurrency ?? 'ARS')
  text = text.replace(/\b(?:usd|dolares|ars|pesos)\b|u\$[sd]/g, ' ')

  // Argentine separators; dot-decimal is supported only when unambiguous.
  const amounts = [
    ...text.matchAll(/(?:\$\s*)?\b\d+(?:[.,]\d+)*(?:\s*(?:mil|k)\b)?/g),
  ]
  if (amounts.length !== 1)
    return invalid(
      amounts.length === 0
        ? 'No pude detectar un monto. Probá con algo como "cafe 2500".'
        : 'Hay varios números. Escribí solo el precio total; los detalles los podés completar al revisar.'
    )
  const token = amounts[0][0]
  const raw = token.replace(/\$|\s/g, '').replace(/(?:mil|k)$/, '')
  if (
    !/^\d+(?:,\d{1,2}|\.\d{1,2})?$|^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)
  ) {
    return invalid('Revisá el monto. Usá un formato como 20.000 o 20.000,50.')
  }
  const number = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(?:\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, '')
      : raw
  const amount =
    Number(number) *
    (/\b(?:mil|k)\b/.test(token) || /\dk$/.test(token) ? 1000 : 1)
  if (!Number.isFinite(amount) || amount < 1 || amount > 1_000_000_000_000)
    return invalid(
      'El monto tiene que ser mayor a cero y estar dentro de un rango válido.'
    )
  // Reject signs and ranges rather than turning a refund into an expense.
  const start = amounts[0].index ?? 0
  if (/[+-]\s*$/.test(text.slice(0, start)))
    return invalid('Escribí un monto positivo, sin signos ni rangos.')
  text = text.replace(token, ' ')

  const methods = [
    [/\b(efectivo|cash)\b/, 'CASH'],
    [/\b(debito)\b/, 'DEBIT'],
    [/\b(transferencia|transferi)\b/, 'TRANSFER'],
    [/\b(credito|visa|mastercard|amex|tarjeta)\b/, 'CREDIT'],
  ] as const
  const detected = methods.filter(([pattern]) => pattern.test(text))
  if (
    detected.length > 1 ||
    (installments && detected.some(([, method]) => method !== 'CREDIT'))
  )
    return invalid('Hay medios de pago distintos. Elegí uno por movimiento.')
  const payment_method = installments ? 'CREDIT' : (detected[0]?.[1] ?? 'DEBIT')
  const description = text
    .replace(
      /\b(?:gaste|gasté|pague|pago|compre|compré|gasto|por|de|el|la|en|con|al|un|una|efectivo|cash|debito|credito|transferencia|transferi|tarjeta)\b/g,
      ' '
    )
    .replace(/^[\s,:;.-]+|[\s,:;.-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!description || description.length > 100)
    return invalid('Agregá una descripción corta, por ejemplo “súper 20 mil”.')
  return {
    is_valid: true,
    amount: Math.round(amount * 100) / 100,
    currency,
    category:
      CATEGORIES.find(([, pattern]) => pattern.test(description))?.[0] ??
      'Otros',
    description,
    is_want: null,
    payment_method,
    card_id: null,
    installments,
    date,
  }
}
