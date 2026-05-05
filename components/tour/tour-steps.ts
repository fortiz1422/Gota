export type TooltipPosition = 'top' | 'bottom'

export interface TourStep {
  target: string
  title: string
  body: string
  position: TooltipPosition
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: 'smart-input',
    title: 'Input inteligente',
    body: 'Escribí como hablás: "café 2500 con amigos". Gota entiende montos, categorías y cuentas.',
    position: 'top',
  },
  {
    target: 'saldo-vivo',
    title: 'Saldo Vivo',
    body: 'Tu balance real del mes, descontando deuda de tarjeta. Siempre sabés cuánto podés gastar.',
    position: 'bottom',
  },
  {
    target: 'tab-movimientos',
    title: 'Movimientos',
    body: 'Todos tus gastos, ingresos y transferencias organizados por fecha.',
    position: 'top',
  },
  {
    target: 'tab-analytics',
    title: 'Análisis',
    body: 'Patrones de gasto, categorías top, compromisos de tarjeta y más.',
    position: 'top',
  },
]
