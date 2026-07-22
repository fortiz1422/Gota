import { describe, expect, it } from 'vitest'
import { buildHorizonEvents } from '@/components/dashboard/desktop/desktop-dashboard-model'
import type { Card, Expense, Instrument, RecurringIncome, Subscription } from '@/types/database'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'

const card = (id: string, name: string): Card => ({ id, name }) as unknown as Card

const compromisos = (tarjetas: unknown[]): CompromisosData => ({ tarjetas }) as unknown as CompromisosData

const base = {
  recurringIncomes: [] as RecurringIncome[],
  activeInstruments: [] as Instrument[],
  selectedMonth: '2026-06',
  today: '2026-06-01',
}

describe('buildHorizonEvents — tarjetas solo con actividad', () => {
  it('incluye cierre solo si hay consumo en el ciclo', () => {
    const events = buildHorizonEvents({
      ...base,
      cards: [card('c1', 'Visa'), card('c2', 'Amex')],
      compromisos: compromisos([
        { id: 'c1', name: 'Visa', currentSpend: 5000, daysUntilClosing: 5, debtTotal: 0, dueDate: null, cycleStatus: 'en_curso' },
        { id: 'c2', name: 'Amex', currentSpend: 0, daysUntilClosing: 8, debtTotal: 0, dueDate: null, cycleStatus: 'en_curso' },
      ]),
    })
    const closes = events.filter((e) => e.kind === 'card')
    expect(closes.map((e) => e.id)).toEqual(['close-c1'])
    expect(closes[0].date).toBe('2026-06-06')
    expect(closes[0].amount).toBe(5000)
  })

  it('incluye vencimiento solo si hay deuda pendiente y no está pagado', () => {
    const events = buildHorizonEvents({
      ...base,
      cards: [card('c1', 'Visa'), card('c2', 'Amex'), card('c3', 'Naranja')],
      compromisos: compromisos([
        { id: 'c1', name: 'Visa', currentSpend: 0, daysUntilClosing: null, debtTotal: 20000, dueDate: '2026-06-10', cycleStatus: 'cerrado' },
        { id: 'c2', name: 'Amex', currentSpend: 0, daysUntilClosing: null, debtTotal: 0, dueDate: '2026-06-12', cycleStatus: 'en_curso' },
        { id: 'c3', name: 'Naranja', currentSpend: 0, daysUntilClosing: null, debtTotal: 9000, dueDate: '2026-06-15', cycleStatus: 'pagado' },
      ]),
    })
    const dues = events.filter((e) => e.kind === 'due')
    expect(dues.map((e) => e.id)).toEqual(['due-c1'])
    expect(dues[0].amount).toBe(20000)
  })

  it('ignora vencimientos con fecha ya pasada', () => {
    const events = buildHorizonEvents({
      ...base,
      cards: [card('c1', 'Visa')],
      compromisos: compromisos([
        { id: 'c1', name: 'Visa', currentSpend: 0, daysUntilClosing: null, debtTotal: 20000, dueDate: '2026-05-20', cycleStatus: 'vencido' },
      ]),
    })
    expect(events.filter((e) => e.kind === 'due')).toEqual([])
  })

  it('no genera eventos de tarjeta si no hay compromisos', () => {
    const events = buildHorizonEvents({ ...base, cards: [card('c1', 'Visa')], compromisos: null })
    expect(events.filter((e) => e.kind === 'card' || e.kind === 'due')).toEqual([])
  })

  it('proyecta el ingreso recurrente próximo por su día de recurrencia', () => {
    const events = buildHorizonEvents({
      ...base,
      cards: [],
      compromisos: null,
      recurringIncomes: [
        { id: 'r1', day_of_month: 5, amount: 800000, currency: 'ARS', category: 'salary', description: '', is_active: true } as unknown as RecurringIncome,
      ],
    })
    const incomes = events.filter((e) => e.kind === 'income')
    expect(incomes.length).toBeGreaterThanOrEqual(1)
    expect(incomes[0].date).toBe('2026-06-05')
    expect(incomes[0].amount).toBe(800000)
  })

  it('incluye la próxima suscripción configurada y distingue crédito de débito', () => {
    const events = buildHorizonEvents({
      ...base,
      cards: [],
      compromisos: null,
      today: '2026-06-20',
      subscriptions: [
        { id: 's1', description: 'Streaming', day_of_month: 25, amount: 19000, currency: 'ARS', payment_method: 'CREDIT', is_active: true } as Subscription,
        { id: 's2', description: 'Internet', day_of_month: 10, amount: 32000, currency: 'ARS', payment_method: 'DEBIT', is_active: true } as Subscription,
      ],
    })

    expect(events.filter(({ kind }) => kind === 'subscription')).toMatchObject([
      { id: 'subscription-s1', date: '2026-06-25', paymentMethod: 'CREDIT' },
      { id: 'subscription-s2', date: '2026-07-10', paymentMethod: 'DEBIT' },
    ])
  })

  it('muestra solo la próxima fila materializada de cada compra en cuotas', () => {
    const installment = (id: string, group: string, date: string, number: number) => ({
      id,
      installment_group_id: group,
      installment_number: number,
      installment_total: 12,
      date,
      description: 'Notebook',
      amount: 45000,
      currency: 'ARS',
    }) as Expense
    const events = buildHorizonEvents({
      ...base,
      cards: [],
      compromisos: null,
      today: '2026-06-20',
      futureInstallments: [
        installment('i4', 'group-1', '2026-07-20', 4),
        installment('i3', 'group-1', '2026-06-20', 3),
        installment('i2', 'group-2', '2026-06-24', 2),
      ],
    })

    expect(events.filter(({ kind }) => kind === 'installment')).toMatchObject([
      { id: 'installment-group-1-3', date: '2026-06-20', title: 'Cuota 3/12 · Notebook' },
      { id: 'installment-group-2-2', date: '2026-06-24' },
    ])
  })
})
