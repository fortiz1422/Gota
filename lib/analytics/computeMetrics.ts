import type { Expense } from '@/types/database'

export type CategoriaMetric = {
  category: string
  total: number
  cantidad: number
  tipo: 'need' | 'want' | 'mixed'
  pctDelTotal: number
  ticketPromedio: number
}

export type ConcentracionDeseo = {
  category: string
  pctDelTotal: number
  cantidad: number
  ticketPromedio: number
}

export type Metrics = {
  // NIVEL 1 — siempre disponibles
  totalGastado: number
  currency: 'ARS' | 'USD'
  totalNecesidad: number
  totalDeseo: number
  pctDeseo: number
  pctNecesidad: number
  categorias: CategoriaMetric[]
  topCategoriaMonto: CategoriaMetric
  topCategoriaFrecuencia: CategoriaMetric
  semanaMasCara: number
  pctSemana1DelTotal: number
  diasSinGasto: number
  pctDiasSinGasto: number
  diasSinDeseo: number
  pctCredito: number
  categoryConcentration: ConcentracionDeseo[]

  // PATRONES DE COMPORTAMIENTO
  gastoMasGrande: { amount: number; category: string; pctDelTotal: number }
  goteoCount: number
  goteoTotal: number
  pctGoteoDelTotal: number
  pctDeseoFinDeSemana: number

  // NIVEL 2 — solo si income !== null
  ingresoMes: number | null
  pctGastadoDelIngreso: number | null
  ahorroActual: number | null
  proyeccionCierre: number | null
  ahorroProyectado: number | null
  diasDeRunway: number | null
  diasRestantes: number

  // Meta
  cantidadTransacciones: number
  hasIngreso: boolean
  esPrimerosDias: boolean
  dayOfMonth: number
}

function weekOf(day: number): number {
  if (day <= 7) return 1
  if (day <= 14) return 2
  if (day <= 21) return 3
  if (day <= 28) return 4
  return 5
}

const EMPTY_CATEGORIA: CategoriaMetric = {
  category: '',
  total: 0,
  cantidad: 0,
  tipo: 'need',
  pctDelTotal: 0,
  ticketPromedio: 0,
}

export function computeMetrics(
  expenses: Expense[],
  ingresoMes: number | null,
  currency: 'ARS' | 'USD',
  selectedMonth: string, // YYYY-MM
): Metrics {
  const cantidadTransacciones = expenses.length

  const [year, month] = selectedMonth.split('-').map(Number)
  const today = new Date()
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === month
  const daysInMonth = new Date(year, month, 0).getDate()
  const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth
  const diasRestantes = isCurrentMonth ? daysInMonth - dayOfMonth : 0

  const hasIngreso = ingresoMes !== null && ingresoMes > 0

  if (cantidadTransacciones === 0) {
    return {
      totalGastado: 0,
      currency,
      totalNecesidad: 0,
      totalDeseo: 0,
      pctDeseo: 0,
      pctNecesidad: 0,
      categorias: [],
      topCategoriaMonto: EMPTY_CATEGORIA,
      topCategoriaFrecuencia: EMPTY_CATEGORIA,
      semanaMasCara: 1,
      pctSemana1DelTotal: 0,
      diasSinGasto: dayOfMonth,
      pctDiasSinGasto: 100,
      diasSinDeseo: dayOfMonth,
      pctCredito: 0,
      categoryConcentration: [],
      gastoMasGrande: { amount: 0, category: '', pctDelTotal: 0 },
      goteoCount: 0,
      goteoTotal: 0,
      pctGoteoDelTotal: 0,
      pctDeseoFinDeSemana: 0,
      ingresoMes,
      pctGastadoDelIngreso: null,
      ahorroActual: null,
      proyeccionCierre: null,
      ahorroProyectado: null,
      diasDeRunway: null,
      diasRestantes,
      cantidadTransacciones: 0,
      hasIngreso,
      esPrimerosDias: true,
      dayOfMonth,
    }
  }

  // — CATEGORÍAS —
  const catMap: Record<string, { total: number; txs: Expense[] }> = {}
  for (const e of expenses) {
    if (!catMap[e.category]) catMap[e.category] = { total: 0, txs: [] }
    catMap[e.category].total += e.amount
    catMap[e.category].txs.push(e)
  }

  const totalGastado = Object.values(catMap).reduce((s, c) => s + c.total, 0)

  const categorias: CategoriaMetric[] = Object.entries(catMap)
    .map(([category, { total, txs }]) => {
      const tieneNecesidad = txs.some((tx) => tx.is_want === false)
      const tieneDeseo = txs.some((tx) => tx.is_want === true)
      const tipo: 'need' | 'want' | 'mixed' =
        tieneNecesidad && tieneDeseo ? 'mixed' : tieneDeseo ? 'want' : 'need'
      return {
        category,
        total,
        cantidad: txs.length,
        tipo,
        pctDelTotal:
          totalGastado > 0 ? Math.round((total / totalGastado) * 100) : 0,
        ticketPromedio: Math.round(total / txs.length),
      }
    })
    .sort((a, b) => b.total - a.total)

  const topCategoriaMonto = categorias[0]
  const tipoRank = { want: 0, mixed: 1, need: 2 }
  const topCategoriaFrecuencia =
    [...categorias]
      .filter((c) => c.tipo !== 'need')
      .sort(
        (a, b) =>
          b.cantidad - a.cantidad || tipoRank[a.tipo] - tipoRank[b.tipo],
      )[0] ?? EMPTY_CATEGORIA

  // — TOTALES —
  let totalNecesidad = 0
  let totalDeseo = 0
  for (const e of expenses) {
    if (e.is_want === true) totalDeseo += e.amount
    else if (e.is_want === false) totalNecesidad += e.amount
  }
  const pctDeseo =
    totalGastado > 0 ? Math.round((totalDeseo / totalGastado) * 100) : 0
  const pctNecesidad =
    totalGastado > 0 ? Math.round((totalNecesidad / totalGastado) * 100) : 0

  // — SEMANAS —
  const weekTotals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const e of expenses) {
    weekTotals[weekOf(new Date(e.date).getDate())] += e.amount
  }
  const semanaMasCara = Number(
    Object.entries(weekTotals).reduce(
      ([bw, bt], [w, t]) => (t > bt ? [w, t] : [bw, bt]),
      ['1', 0],
    )[0],
  )
  const pctSemana1DelTotal =
    totalGastado > 0 ? Math.round((weekTotals[1] / totalGastado) * 100) : 0

  // — DÍAS SIN GASTO —
  const datesWithExpenses = new Set(
    expenses.map((e) => new Date(e.date).getDate()),
  )
  let diasSinGasto = 0
  for (let d = 1; d <= dayOfMonth; d++) {
    if (!datesWithExpenses.has(d)) diasSinGasto++
  }
  const pctDiasSinGasto =
    dayOfMonth > 0 ? Math.round((diasSinGasto / dayOfMonth) * 100) : 0

  // — DÍAS SIN DESEO (racha actual hacia atrás) —
  const datesWithWant = new Set(
    expenses
      .filter((e) => e.is_want === true)
      .map((e) => new Date(e.date).getDate()),
  )
  let diasSinDeseo = 0
  for (let d = dayOfMonth; d >= 1; d--) {
    if (datesWithWant.has(d)) break
    diasSinDeseo++
  }

  // — CRÉDITO —
  const totalCredito = expenses
    .filter((e) => e.payment_method === 'CREDIT')
    .reduce((s, e) => s + e.amount, 0)
  const pctCredito =
    totalGastado > 0 ? Math.round((totalCredito / totalGastado) * 100) : 0

  // — CONCENTRACIÓN DESEO —
  const categoryConcentration: ConcentracionDeseo[] = categorias
    .filter(
      (c) => (c.tipo === 'want' || c.tipo === 'mixed') && c.pctDelTotal >= 15,
    )
    .map((c) => ({
      category: c.category,
      pctDelTotal: c.pctDelTotal,
      cantidad: c.cantidad,
      ticketPromedio: c.ticketPromedio,
    }))

  // — GASTO MÁS GRANDE —
  const maxExpense = expenses.reduce(
    (max, e) => (e.amount > max.amount ? e : max),
    expenses[0],
  )
  const gastoMasGrande = {
    amount: maxExpense.amount,
    category: maxExpense.category,
    pctDelTotal:
      totalGastado > 0
        ? Math.round((maxExpense.amount / totalGastado) * 100)
        : 0,
  }

  // — GOTEO (gastos menores al 2% del ingreso mensual) —
  const goteoThreshold = hasIngreso && ingresoMes ? ingresoMes * 0.02 : 0
  const goteoExpenses =
    goteoThreshold > 0 ? expenses.filter((e) => e.amount < goteoThreshold) : []
  const goteoCount = goteoExpenses.length
  const goteoTotal = goteoExpenses.reduce((s, e) => s + e.amount, 0)
  const pctGoteoDelTotal =
    totalGastado > 0 ? Math.round((goteoTotal / totalGastado) * 100) : 0

  // — FIN DE SEMANA (Vie=5, Sáb=6, Dom=0) —
  const totalDeseoFdS = expenses
    .filter((e) => e.is_want === true)
    .filter((e) => {
      const d = new Date(e.date).getDay()
      return d === 0 || d === 5 || d === 6
    })
    .reduce((s, e) => s + e.amount, 0)
  const pctDeseoFinDeSemana =
    totalDeseo > 0 ? Math.round((totalDeseoFdS / totalDeseo) * 100) : 0

  // — NIVEL 2: PROYECCIONES —
  let pctGastadoDelIngreso: number | null = null
  let ahorroActual: number | null = null
  let proyeccionCierre: number | null = null
  let ahorroProyectado: number | null = null
  let diasDeRunway: number | null = null

  if (hasIngreso && ingresoMes) {
    pctGastadoDelIngreso = Math.round((totalGastado / ingresoMes) * 100)
    ahorroActual = Math.round(ingresoMes - totalGastado)
    const dailyRate = dayOfMonth > 0 ? totalGastado / dayOfMonth : 0
    proyeccionCierre = Math.round(dailyRate * daysInMonth)
    ahorroProyectado = Math.round(ingresoMes - proyeccionCierre)
    diasDeRunway = dailyRate > 0 ? Math.floor(ingresoMes / dailyRate) : null
  }

  return {
    totalGastado,
    currency,
    totalNecesidad,
    totalDeseo,
    pctDeseo,
    pctNecesidad,
    categorias,
    topCategoriaMonto,
    topCategoriaFrecuencia,
    semanaMasCara,
    pctSemana1DelTotal,
    diasSinGasto,
    pctDiasSinGasto,
    diasSinDeseo,
    pctCredito,
    categoryConcentration,
    gastoMasGrande,
    goteoCount,
    goteoTotal,
    pctGoteoDelTotal,
    pctDeseoFinDeSemana,
    ingresoMes,
    pctGastadoDelIngreso,
    ahorroActual,
    proyeccionCierre,
    ahorroProyectado,
    diasDeRunway,
    diasRestantes,
    cantidadTransacciones,
    hasIngreso,
    esPrimerosDias: cantidadTransacciones < 3,
    dayOfMonth,
  }
}
