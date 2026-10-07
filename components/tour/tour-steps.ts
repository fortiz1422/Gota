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
    title: 'Tu próximo gasto empieza acá',
    body: 'Escribí como lo contarías. Antes de guardar, revisás el monto, la fecha y de dónde salió la plata.',
    position: 'top',
  },
  {
    target: 'disponible-real',
    title: 'Lo que te queda para usar',
    body: 'Parte de tus cuentas y descuenta los compromisos que cargaste. Las deudas que no registraste todavía no están incluidas.',
    position: 'bottom',
  },
  {
    target: 'home-plus',
    title: 'Más formas de registrar',
    body: 'Desde el + cargás ingresos, transferencias y cuotas en curso de compras anteriores a Gota. Para agregar cuentas o tarjetas, entrá a Configuración.',
    position: 'bottom',
  },
]
