import { formatAmount } from '@/lib/format'
import type { Metrics } from './computeMetrics'

export type InsightResult = {
  titular: string
  chips: string[]
  sentiment: 'positive' | 'alert' | 'neutral'
}

type InsightKey =
  | 'F1'
  | 'F2'
  | 'A1'
  | 'A2'
  | 'A3'
  | 'A4'
  | 'B1'
  | 'B2'
  | 'B3'
  | 'B4'
  | 'C1'
  | 'C2'
  | 'D1'
  | 'D2'
  | 'E1'
  | 'G1'
  | 'G2'
  | 'G3'
  | 'G4'
  | 'G5'
  | 'G6'
  | 'G7'
  | 'G8'

function buildTitular(key: InsightKey, m: Metrics): string {
  const currency = m.currency
  const pctAhorro = 100 - (m.pctGastadoDelIngreso ?? 0)
  switch (key) {
    case 'F1':
      return 'Mes recién arranca. Volvé a fin de mes para ver cómo te fue.'
    case 'F2':
      return 'El mes sigue. Seguí cargando para ver el panorama completo.'
    case 'A1':
      return `Guardaste el ${pctAhorro}% de lo que ganaste este mes. Uno de tus mejores cierres.`
    case 'A2':
      return `Ya gastaste el ${m.pctGastadoDelIngreso}% de tus ingresos y quedan ${m.diasRestantes} días. Todavía podés ajustar.`
    case 'A3':
      return 'Casi todo lo que gastaste este mes tenía sentido. Mes tranquilo.'
    case 'A4':
      return 'Este mes te diste bastantes gustos. Nada malo, pero vale tenerlo en cuenta.'
    case 'B1':
      return `${m.categoryConcentration[0]?.category} se lleva casi un cuarto de todo lo que gastás este mes. Vale revisarlo.`
    case 'B2':
      return `${m.categoryConcentration[0]?.category} ya representa el ${m.categoryConcentration[0]?.pctDelTotal}% de todo lo que gastás este mes.`
    case 'B3':
      return `Ya van ${m.topCategoriaFrecuencia.cantidad} veces en ${m.topCategoriaFrecuencia.category} este mes. Se está volviendo un hábito.`
    case 'B4':
      return `Cada vez que gastás en ${m.topCategoriaMonto.category} te sale en promedio ${formatAmount(m.topCategoriaMonto.ticketPromedio, currency)}. No es frecuente, pero pesa.`
    case 'C1':
      return `El ${m.pctSemana1DelTotal}% de lo que gastaste fue en la primera semana. Arrancaste el mes con el pie pesado.`
    case 'C2':
      return `${m.diasSinDeseo} días seguidos sin gastar en gustos. Tu mejor racha del mes.`
    case 'D1':
      return `El ${m.pctCredito}% de lo que gastaste todavía no lo sentiste en el bolsillo. Lo vas a sentir el mes que viene.`
    case 'D2':
      return 'Todo en efectivo o débito este mes. Lo que salió, salió en el momento.'
    case 'E1':
      return `Al ritmo que vas, el mes cierra en rojo por ${formatAmount(Math.abs(m.ahorroProyectado ?? 0), currency)}. Todavía estás a tiempo de ajustar.`
    case 'G1':
      return `Un solo gasto se llevó el ${m.gastoMasGrande.pctDelTotal}% del mes. Si estaba planeado, perfecto. Si no, a recalcular.`
    case 'G2':
      return 'Muchos gastos chicos este mes. El goteo constante a veces vacía el vaso más rápido que un solo trago.'
    case 'G3':
      return `${m.diasSinGasto} días sin registrar ninguna salida de dinero. El silencio financiero también es un logro.`
    case 'G4':
      return 'Tus fines de semana están marcando el ritmo. El viernes a la noche tiene un efecto en el bolsillo.'
    case 'G5':
      return `La categoría "Otros" pesa demasiado. Ponerle nombre al gasto es el primer paso para controlarlo.`
    case 'G6':
      return 'Últimos días del mes. Queda poco margen, pero la pista de aterrizaje está a la vista. Mantené el pulso.'
    case 'G7':
      return `Los primeros días del mes y ya va el ${m.pctGastadoDelIngreso}% del ingreso. El peaje de arranque está pesando.`
    case 'G8':
      return 'Proporciones en equilibrio. Cubriste lo importante, te diste gustos y el saldo respira.'
  }
}

function buildChip(key: InsightKey, m: Metrics): string {
  const currency = m.currency
  const pctAhorro = 100 - (m.pctGastadoDelIngreso ?? 0)
  switch (key) {
    case 'F1':
      return ''
    case 'F2':
      return ''
    case 'A1':
      return `Ahorraste el ${pctAhorro}% de tus ingresos`
    case 'A2':
      return `${m.pctGastadoDelIngreso}% del ingreso usado`
    case 'A3':
      return 'Casi todo fue gasto necesario'
    case 'A4':
      return 'Bastantes gustos este mes'
    case 'B1':
      return `${m.categoryConcentration[0]?.category}: ~25% del total`
    case 'B2':
      return `${m.categoryConcentration[0]?.category}: ${m.categoryConcentration[0]?.pctDelTotal}% del gasto`
    case 'B3':
      return `${m.topCategoriaFrecuencia.category}, ${m.topCategoriaFrecuencia.cantidad} veces`
    case 'B4':
      return `${m.topCategoriaMonto.category}: ${formatAmount(m.topCategoriaMonto.ticketPromedio, currency)} promedio`
    case 'C1':
      return `Primera semana: ${m.pctSemana1DelTotal}% del gasto`
    case 'C2':
      return `${m.diasSinDeseo} días sin gustos`
    case 'D1':
      return `${m.pctCredito}% en tarjeta (diferido)`
    case 'D2':
      return 'Todo en efectivo o débito'
    case 'E1':
      return 'Proyección: cierre en rojo'
    case 'G1':
      return `${m.gastoMasGrande.category}: ${m.gastoMasGrande.pctDelTotal}% del total`
    case 'G2':
      return `${m.goteoCount} gastos chicos, ${m.pctGoteoDelTotal}% del total`
    case 'G3':
      return `${m.diasSinGasto} días sin movimiento`
    case 'G4':
      return `${m.pctDeseoFinDeSemana}% de gustos en fin de semana`
    case 'G5': {
      const otros = m.categorias.find((c) => c.category === 'Otros')
      return otros ? `"Otros": ${otros.pctDelTotal}% del gasto` : '"Otros" sin categorizar'
    }
    case 'G6':
      return `Quedan ${m.diasRestantes} días, margen justo`
    case 'G7':
      return `${m.pctGastadoDelIngreso}% gastado en la primera semana`
    case 'G8':
      return 'Necesidades y deseos en equilibrio'
  }
}

const RULE_SENTIMENT: Record<InsightKey, 'positive' | 'alert' | 'neutral'> = {
  F1: 'neutral',
  F2: 'neutral',
  A1: 'positive',
  A2: 'alert',
  A3: 'positive',
  A4: 'neutral',
  B1: 'alert',
  B2: 'neutral',
  B3: 'neutral',
  B4: 'neutral',
  C1: 'alert',
  C2: 'positive',
  D1: 'alert',
  D2: 'positive',
  E1: 'alert',
  G1: 'alert',
  G2: 'alert',
  G3: 'positive',
  G4: 'alert',
  G5: 'neutral',
  G6: 'neutral',
  G7: 'alert',
  G8: 'positive',
}

function getMatchingRules(m: Metrics): InsightKey[] {
  if (m.esPrimerosDias) return ['F1']

  const rules: InsightKey[] = []
  const topConc = m.categoryConcentration[0]

  // 1. E1 — cierre en rojo (más urgente, solo con suficientes datos)
  if (
    m.hasIngreso &&
    m.ahorroProyectado !== null &&
    m.ahorroProyectado < 0 &&
    m.dayOfMonth >= 10
  )
    rules.push('E1')

  // 2. G6 — aterrizaje forzoso (fin de mes, margen justo pero no negativo)
  if (
    m.hasIngreso &&
    m.diasRestantes < 5 &&
    (m.pctGastadoDelIngreso ?? 0) >= 90 &&
    (m.pctGastadoDelIngreso ?? 0) <= 95 &&
    (m.ahorroProyectado ?? -1) >= 0
  )
    rules.push('G6')

  // 3. A2 — casi sin ingreso disponible
  if (m.hasIngreso && (m.pctGastadoDelIngreso ?? 0) >= 90) rules.push('A2')

  // 4. G7 — peaje de principio de mes
  if (m.hasIngreso && m.dayOfMonth <= 7 && (m.pctGastadoDelIngreso ?? 0) > 40)
    rules.push('G7')

  // 5. B1 — concentración extrema (≥25%)
  if (topConc?.pctDelTotal >= 25) rules.push('B1')

  // 6. G1 — gasto elefante (una sola tx > 30% del total)
  if (m.gastoMasGrande.pctDelTotal > 30) rules.push('G1')

  // 7. C1 — primera semana muy pesada (solo tiene sentido pasada la semana 1)
  if (m.pctSemana1DelTotal > 50 && m.dayOfMonth > 7) rules.push('C1')

  // 8. A4 — muchos gustos (threshold ajustado por momento del mes)
  const a4Threshold = m.dayOfMonth <= 10 ? 40 : 50
  if (m.pctDeseo > a4Threshold) rules.push('A4')

  // 9. G5 — agujero negro "Otros"
  const otrosIdx = m.categorias.findIndex((c) => c.category === 'Otros')
  if (otrosIdx !== -1 && (m.categorias[otrosIdx].pctDelTotal >= 15 || otrosIdx < 2))
    rules.push('G5')

  // 10. G2 — goteo constante (requiere ingreso para calcular threshold)
  if (m.hasIngreso && m.goteoCount > 15 && m.pctGoteoDelTotal > 15)
    rules.push('G2')

  // 11. A1 — ahorraste bien (solo desde día 15)
  if (m.hasIngreso && (m.pctGastadoDelIngreso ?? 0) <= 30 && m.dayOfMonth >= 15)
    rules.push('A1')

  // 12. B2 — concentración moderada (15–24%)
  if (topConc?.pctDelTotal >= 15 && topConc?.pctDelTotal < 25) rules.push('B2')

  // 13. B3 — frecuencia alta en want/mixed (threshold ajustado por momento del mes)
  const b3Threshold = m.dayOfMonth <= 10 ? 3 : 5
  if (
    m.topCategoriaFrecuencia.cantidad >= b3Threshold &&
    m.topCategoriaFrecuencia.tipo !== 'need'
  )
    rules.push('B3')

  // 14. G4 — efecto fin de semana
  if (m.pctDeseoFinDeSemana > 60 && m.totalDeseo > 0) rules.push('G4')

  // 15. B4 — ticket más alto del mes en want/mixed
  if (m.categorias.length > 0) {
    const highestTicket = Math.max(...m.categorias.map((c) => c.ticketPromedio))
    if (
      m.topCategoriaMonto.tipo !== 'need' &&
      m.topCategoriaMonto.ticketPromedio === highestTicket
    )
      rules.push('B4')
  }

  // 16. G8 — proporción áurea (equilibrio necesidades/deseos/margen)
  if (
    m.dayOfMonth > 20 &&
    m.hasIngreso &&
    m.pctNecesidad >= 50 &&
    m.pctNecesidad <= 60 &&
    m.pctDeseo >= 20 &&
    m.pctDeseo <= 30 &&
    (100 - (m.pctGastadoDelIngreso ?? 100)) > 15
  )
    rules.push('G8')

  // 17. C2 — racha sin deseos (desde la 3ª semana tiene contexto real)
  if (m.diasSinDeseo >= 7 && m.dayOfMonth > 15) rules.push('C2')

  // 18. G3 — días de silencio financiero
  if (m.pctDiasSinGasto > 30 && m.dayOfMonth > 15) rules.push('G3')

  // 19. D1 — mucho crédito
  if (m.pctCredito > 40) rules.push('D1')

  // 20. D2 — todo efectivo/débito
  if (m.pctCredito === 0) rules.push('D2')

  // 21. A3 — mes tranquilo
  if (m.pctDeseo < 20) rules.push('A3')

  if (rules.length === 0) rules.push('F2')

  return rules
}

export function evaluateInsights(metrics: Metrics): InsightResult {
  const rules = getMatchingRules(metrics)
  const [mainRule, ...restRules] = rules

  const titular = buildTitular(mainRule, metrics)
  const sentiment = RULE_SENTIMENT[mainRule]

  const chips = restRules
    .slice(0, 3)
    .map((key) => buildChip(key, metrics))
    .filter((chip) => chip.length > 0 && chip.length <= 50)

  return { titular, chips, sentiment }
}
