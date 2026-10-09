const messages: Record<string, string> = {
  invalid_transfer: 'Elegí otra cuenta propia y un importe válido.',
  peer_confirmation_required:
    'La otra cuenta tiene un ajuste. Elegí qué diferencia explica la transferencia o revisá su saldo antes de cargarla.',
  state_changed: 'Cambió el saldo. Volvé a confirmarlo.',
  balance_changed: 'Cambió el saldo. Volvé a confirmarlo.',
  date_required: 'Elegí la fecha real del movimiento.',
  after_checkpoint:
    'Ese movimiento ocurrió después de confirmar el saldo. Revisá la fecha.',
  outside_interval:
    'La fecha pertenece a una confirmación anterior. Revisá el movimiento.',
  same_day_confirmation: 'Confirmá que ocurrió antes de consultar el saldo.',
  effect_exceeds_gap:
    'El movimiento no coincide con el sentido o el importe pendiente.',
  invalid_income: 'Revisá importe, descripción y categoría del ingreso.',
  invalid_expense: 'Revisá importe, descripción y categoría del gasto.',
  confirmation_required:
    'Confirmá que el movimiento ya estaba incluido en ese saldo.',
  already_resolved: 'Ese movimiento ya explica una diferencia.',
  undo_resolutions_first:
    'Desvinculá los movimientos de este ajuste antes de revertirlo.',
}
export function reconciliationErrorMessage(code: string) {
  return (
    messages[code] ??
    'No pudimos completar este paso. Revisá los datos y reintentá.'
  )
}
