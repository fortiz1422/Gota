import { describe, expect, it } from 'vitest'
import { planWithConversationContext } from '../chat-context'

describe('planWithConversationContext — follow-ups deterministas', () => {
  it('una pregunta con sujeto propio no hereda nada', () => {
    const plan = planWithConversationContext(
      '¿Cuánto gasto normalmente en supermercado?',
      '¿Me alcanza comprar algo de 600.000?',
    )
    expect(plan.intent).toBe('category_history')
    expect(plan.movementFilter.terms).toContain('supermercado')
    expect(plan.simulation.amount).toBeNull()
  })

  it('"¿Y el mes pasado?" retiene la categoría y cambia la ventana', () => {
    const plan = planWithConversationContext(
      '¿Y el mes pasado?',
      '¿Cuánto gasto normalmente en supermercado?',
    )
    expect(plan.intent).toBe('category_history')
    expect(plan.movementFilter.terms).toContain('supermercado')
    expect(plan.movementFilter.window).toBe('previous_month')
  })

  it('"¿Y en 6 cuotas?" retiene el monto y cambia las cuotas', () => {
    const plan = planWithConversationContext(
      '¿Y en 6 cuotas?',
      '¿Me alcanza comprar algo de 600.000?',
    )
    expect(plan.intent).toBe('affordability')
    expect(plan.simulation.amount).toBe(600_000)
    expect(plan.simulation.installments).toBe(6)
  })

  it('sin turno anterior el plan es el de siempre', () => {
    const plan = planWithConversationContext('¿Y el mes pasado?', null)
    expect(plan.movementFilter.window).toBe('previous_month')
    expect(plan.movementFilter.terms).toHaveLength(0)
  })

  it('un follow-up largo con tema nuevo no hereda', () => {
    const plan = planWithConversationContext(
      'y contame también qué compromisos fuertes tengo antes de fin de mes por favor',
      '¿Cuánto gasto normalmente en supermercado?',
    )
    expect(plan.intent).not.toBe('category_history')
  })
})
