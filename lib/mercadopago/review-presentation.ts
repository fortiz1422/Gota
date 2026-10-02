import { getMercadoPagoReviewCapability, type MercadoPagoMovement } from './review'

// Presentation only: never grants permission to post or changes provider evidence.
export function getMercadoPagoReviewPresentation(movement: MercadoPagoMovement) {
  if (movement.attention === 'possible_duplicate') {
    return { ready: false, title: 'Posible duplicado', explanation: 'Encontramos un gasto de importe, moneda y fecha compatibles que podría ser este mismo movimiento. Comparalo antes de registrar otro.', action: 'Comparar movimiento' }
  }
  if ((movement.summary?.refunded ?? 0) > 0 || ['refunded', 'charged_back', 'in_mediation'].includes(movement.operation?.statusDetail ?? '') || ['refunded', 'charged_back', 'in_mediation'].includes(movement.operation?.status ?? '')) {
    return { ready: false, title: 'Devolución o reclamo', explanation: 'Necesitamos resolver esta operación contra la compra original antes de registrarla.', action: 'Ver detalle' }
  }
  const capability = getMercadoPagoReviewCapability(movement)
  if (capability.mode === 'confirmable') {
    if (movement.kind === 'transfer' || movement.operation?.type === 'money_transfer') {
      return { ready: true, title: 'Transferencia saliente', explanation: 'Si pagaste un consumo, revisá la descripción y categoría para registrarlo como gasto con saldo de Mercado Pago. Si fue entre tus cuentas, descartalo. Sólo se registra cuando confirmás.', action: 'Revisar como gasto' }
    }
    return capability.reason === 'complete_credit_card_purchase'
      ? { ready: true, title: 'Compra con tarjeta', explanation: 'Elegí la tarjeta y revisá la categoría. No se descontará del saldo de Mercado Pago.', action: 'Completar compra' }
      : { ready: true, title: 'Salida de saldo', explanation: 'Revisá qué representa esta salida antes de registrarla como gasto.', action: 'Revisar y completar' }
  }
  if (movement.kind === 'transfer' || movement.operation?.type === 'money_transfer') {
    return { ready: false, title: 'Transferencia por resolver', explanation: 'Falta saber si fue entre tus cuentas o con otra persona. No se registra automáticamente como gasto ni ingreso.', action: 'Ver transferencia' }
  }
  if (movement.fundingSource?.kind === 'card') {
    if (typeof movement.installments === 'number' && movement.installments > 1) {
      return { ready: false, title: 'Compra en cuotas', explanation: `Mercado Pago informa ${movement.installments} cuotas. La compra queda pendiente hasta habilitar la confirmación segura de cuotas o completar la evidencia que falta.`, action: 'Ver compra' }
    }
    return { ready: false, title: 'Compra por verificar', explanation: 'Falta información de la compra o de su tarjeta para poder registrarla con seguridad.', action: 'Ver qué falta' }
  }
  return { ready: false, title: 'Movimiento por identificar', explanation: 'El importe por sí solo no alcanza para saber si fue un gasto, un ingreso u otro movimiento. Queda pendiente hasta tener más evidencia.', action: 'Ver qué falta' }
}

export function formatMercadoPagoObservedDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Sin fecha'
  return new Date(value).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
}
