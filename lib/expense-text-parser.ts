import type { ParsedExpense } from '@/lib/validation/schemas'

type Options = { defaultCurrency?: 'ARS' | 'USD' }
const invalid = (reason: string): ParsedExpense => ({ is_valid: false, reason })
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const CATEGORIES: Array<[string, RegExp]> = [
  [
    'Supermercado',
    /\b(super|supermercado|carrefour|coto|dia|jumbo|la anonima)\b/,
  ],
  ['Kiosco y Varios', /\b(kiosco|quiosco)\b/],
  ['Hijos', /\b(panales|mamadera)\b/],
  ['Cuidado Personal', /\b(peluqueria|barberia)\b/],
  ['Muebles y Hogar', /\b(heladera|mueble|sillon|lavarropas)\b/],
  ['Regalos', /\b(regalo)\b/],
  ['Vacaciones', /\b(hotel|alojamiento)\b/],
  ['Cargos Bancarios', /\b(comision bancaria|cargo bancario)\b/],
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
    /\b(cobre|cobro|ingreso|sueldo|recibi|vendi|devolvi|me (pagaron|transfirieron|devolvieron|acreditaron|depositaron|reintegraron)|devolucion|reintegro|reembolso)\b/.test(
      text
    )
  ) {
    return invalid('Esto parece un ingreso. Cargalo desde la opción Ingreso.')
  }
  if (
    /\b(pague|pago|pagar)\s+(?:(?:la|mi|el)\s+)?(tarjeta|visa|mastercard|resumen)\b|\b(entre mis cuentas|a mi (?:otra )?(cuenta|billetera))\b/.test(
      text
    )
  ) {
    return invalid(
      'Esto parece un pago de tarjeta o una transferencia entre tus cuentas. Usá la opción correspondiente para no duplicar gastos.'
    )
  }
  if (
    /\b(pague|pago|pagar)\s+(?:el\s+)?saldo\s+(?:de\s+)?(?:mi\s+|la\s+)?tarjeta\b/.test(
      text
    )
  )
    return invalid('Usá Pago de tarjeta para no duplicar gastos.')
  if (
    /\b(no|nunca|cancele|cancelado|cancelada|voy a comprar|quiero comprar|presupuesto|cotizacion|gastaria|si compro|pagare|comprare|compraria|gasto estimado)\b/.test(
      text
    )
  )
    return invalid(
      'No queda claro si hubo un gasto. Escribí solo el movimiento que querés registrar.'
    )

  if (/\b\d+(?:[.,]\d+)?e[+-]?\d+\b/.test(text))
    return invalid('Escribí el monto completo, sin notación científica.')
  text = text.replace(/(\d)(usd|ars|pesos|dolares|mil)\b/g, '$1 $2')
  if (/\d[a-jl-z]\w*/.test(text))
    return invalid('Separá el monto de la descripción y revisá la unidad.')
  // Dates are resolved before numbers so a day cannot become an amount.
  let date = today
  const base = new Date(`${today}T12:00:00Z`)
  if (!Number.isFinite(base.getTime()))
    return invalid('No pude resolver la fecha. Revisala antes de continuar.')
  // Expand only explicit, bounded date phrases. They still participate in the
  // same multiple-date check rather than silently overriding each other.
  text = text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3/$2/$1')
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ]
  text = text.replace(
    /\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?: de (\d{4}))?\b/g,
    (_, day: string, month: string, year: string | undefined) =>
      `${day}/${months.indexOf(month) + 1}/${year ?? today.slice(0, 4)}`
  )
  text = text.replace(/\b(anoche|hace (?:2|dos) dias)\b/g, (phrase) =>
    phrase === 'anoche' ? 'ayer' : 'anteayer'
  )
  const weekdays = [
    'domingo',
    'lunes',
    'martes',
    'miercoles',
    'jueves',
    'viernes',
    'sabado',
  ]
  if (
    /\b(proximo|proxima|que viene|hace (?!2 dias|dos dias)\S+ dias?)\b/.test(
      text
    )
  )
    return invalid('Usá una fecha concreta para ese movimiento.')
  text = text.replace(
    /\b(domingo|lunes|martes|miercoles|jueves|viernes|sabado)(?: pasado)?\b/g,
    (_, day: string) => {
      const candidate = new Date(base)
      const delta = (base.getUTCDay() - weekdays.indexOf(day) + 7) % 7 || 7
      candidate.setUTCDate(candidate.getUTCDate() - delta)
      return `${candidate.getUTCDate()}/${candidate.getUTCMonth() + 1}/${candidate.getUTCFullYear()}`
    }
  )
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

  const numberWords: Record<string, number> = {
    una: 1,
    un: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    once: 11,
    doce: 12,
    dieciocho: 18,
    veinticuatro: 24,
  }
  text = text.replace(
    /\b(una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|dieciocho|veinticuatro) cuotas?\b/g,
    (_, word: string) => `${numberWords[word]} cuotas`
  )
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

  if (
    /\b(eur|euros?|brl|reales|yenes|jpy|gbp|libras|chf|francos suizos|cad|aud|mxn|clp|pyg|bob|usdt|bitcoin|btc)\b|[€£¥]/.test(
      text
    )
  )
    return invalid('Por ahora usá pesos (ARS) o dólares (USD).')
  const usd = /(?:\b(?:usd|dolares)\b|(?:u\$[sd]|us\$))/i.test(text)
  const ars = /\b(?:ars|pesos)\b/.test(text)
  if (usd && ars)
    return invalid('Hay dos monedas. Registrá un movimiento por moneda.')
  const currency = usd
    ? 'USD'
    : ars || text.includes('$')
      ? 'ARS'
      : (options.defaultCurrency ?? 'ARS')
  text = text.replace(/\b(?:usd|dolares|ars|pesos)\b|(?:u\$[sd]|us\$)/g, ' ')

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
  if (/[+−–—-]\s*$/.test(text.slice(0, start)))
    return invalid('Escribí un monto positivo, sin signos ni rangos.')
  text = text.replace(token, ' ')

  const methods = [
    [/\b(efectivo|cash)\b/, 'CASH'],
    [/\b(debito)\b/, 'DEBIT'],
    [/\b(transferencia|transferi)\b/, 'TRANSFER'],
    [/\bcredito\b|\b(?:visa|mastercard|amex|tarjeta)\b/, 'CREDIT'],
  ] as const
  const methodText = /\bdebito\b/.test(text)
    ? text.replace(/\b(visa|mastercard|amex|tarjeta)\b/g, ' ')
    : text
  const detected = methods.filter(([pattern]) => pattern.test(methodText))
  if (
    detected.length > 1 ||
    (installments && detected.some(([, method]) => method !== 'CREDIT'))
  )
    return invalid('Hay medios de pago distintos. Elegí uno por movimiento.')
  const payment_method = installments ? 'CREDIT' : (detected[0]?.[1] ?? 'DEBIT')
  const description = text
    .replace(
      /\b(?:gaste|gasté|pague|compre|compré|gasto|por|de|en|con|al|un|una|efectivo|cash|debito|credito|transferencia|transferi|tarjeta)\b/g,
      ' '
    )
    .replace(/^pago\s+/, '')
    .replace(/\b(?:el|la)\s*$/, '')
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
