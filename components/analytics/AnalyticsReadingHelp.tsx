import { ContextualHelp } from '@/components/ui/ContextualHelp'

export function AnalyticsReadingHelp() {
  return (
    <ContextualHelp title="Cómo leer Análisis">
      <p>El selector de arriba cambia el mes que estás analizando. Los importes se basan en lo que registraste en Gota.</p>
      <p>En Percibidos, ves salidas de plata, incluidos los pagos de tarjeta. En Todo el gasto, también se incluyen compras y cuotas con tarjeta del período.</p>
      <p>El saldo inicial es tu punto de partida, no un ingreso ni un gasto. Las comparaciones necesitan datos de los períodos comparados; un mes vacío no confirma que no hayas gastado.</p>
    </ContextualHelp>
  )
}
