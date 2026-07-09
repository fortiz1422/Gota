import { describe, expect, it } from 'vitest'
import { detectIntent, extractSearchTerms, planChatQuery } from '../chat-planner'

describe('detectIntent — preguntas de aceptación', () => {
  const cases: Array<[string, string]> = [
    ['¿En qué estoy gastando más este mes?', 'category_breakdown'],
    ['¿Cuál fue mi promedio histórico de gasto en supermercado?', 'category_history'],
    ['¿Qué cambió vs meses anteriores a esta altura?', 'trend_comparison'],
    ['¿Qué compromisos fuertes tengo antes de fin de mes?', 'card_commitments'],
    ['Mostrame movimientos grandes recientes.', 'movement_lookup'],
    ['¿Dónde estoy pasado de presupuesto?', 'budget_question'],
    ['¿Cuánto me queda realmente disponible?', 'balance_status'],
    ['¿Qué debería mirar hoy?', 'what_should_i_do'],
  ]

  it.each(cases)('"%s" → %s', (question, intent) => {
    expect(detectIntent(question)).toBe(intent)
  })
})

describe('detectIntent — variantes', () => {
  it('detecta preguntas de tarjetas y vencimientos', () => {
    expect(detectIntent('cuando vence la visa?')).toBe('card_commitments')
    expect(detectIntent('cuanto debo de la tarjeta')).toBe('card_commitments')
  })

  it('detecta suscripciones por nombre de servicio', () => {
    expect(detectIntent('cuanto pago de netflix?')).toBe('subscription_question')
  })

  it('detecta rendimientos y metas', () => {
    expect(detectIntent('cuanto rinde mi plata en la billetera?')).toBe('yield_question')
    expect(detectIntent('como vienen mis metas?')).toBe('goal_question')
  })

  it('preguntas sin patrón caen en general', () => {
    expect(detectIntent('hola')).toBe('general')
    expect(detectIntent('contame algo')).toBe('general')
  })

  it('sugerencia existente de recorte va a what_should_i_do', () => {
    expect(detectIntent('Donde podria recortar gastos?')).toBe('what_should_i_do')
  })
})

describe('planChatQuery', () => {
  it('movement_lookup con "grandes" activa largeOnly y trae movimientos', () => {
    const plan = planChatQuery('Mostrame movimientos grandes recientes.')
    expect(plan.intent).toBe('movement_lookup')
    expect(plan.includeMovements).toBe(true)
    expect(plan.movementFilter.largeOnly).toBe(true)
    expect(plan.movementFilter.window).toBe('recent')
  })

  it('detecta ventanas temporales', () => {
    expect(planChatQuery('que gaste hoy?').movementFilter.window).toBe('today')
    expect(planChatQuery('mostrame los gastos de ayer').movementFilter.window).toBe('yesterday')
    expect(planChatQuery('movimientos de esta semana').movementFilter.window).toBe('last_week')
    expect(planChatQuery('movimientos del mes pasado').movementFilter.window).toBe('previous_month')
  })

  it('what_should_i_do incluye la sección de insights', () => {
    const plan = planChatQuery('¿Qué debería mirar hoy?')
    expect(plan.sections).toContain('insights')
    expect(plan.includeMovements).toBe(false)
  })

  it('balance_status incluye balances y compromisos', () => {
    const plan = planChatQuery('¿Cuánto me queda realmente disponible?')
    expect(plan.sections).toContain('balances')
    expect(plan.sections).toContain('commitments')
  })

  it('category_history incluye histórico de categoría y conserva el término consultado', () => {
    const plan = planChatQuery('¿Cuál fue mi promedio histórico de gasto en supermercado?')
    expect(plan.intent).toBe('category_history')
    expect(plan.sections).toContain('category_history')
    expect(plan.movementFilter.terms).toContain('supermercado')
  })

  it('trend_comparison conserva término de categoría para comparar a esta altura', () => {
    const plan = planChatQuery('Supermercado fue 800k a esta altura en meses anteriores?')
    expect(plan.intent).toBe('trend_comparison')
    expect(plan.sections).toContain('trend')
    expect(plan.movementFilter.terms).toContain('supermercado')
  })
})

describe('extractSearchTerms', () => {
  it('tokeniza sin acentos ni stopwords', () => {
    expect(extractSearchTerms('¿Cuándo compré en Rappi el pedido?')).toEqual(['rappi', 'pedido'])
  })

  it('descarta tokens cortos', () => {
    expect(extractSearchTerms('qué es eso')).toEqual([])
  })
})
