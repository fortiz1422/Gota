import { describe, it, expect } from 'vitest'
import {
  emptyWorkspace,
  addCheckpoint,
  acceptAdjustment,
  resolveAdjustment,
  reverseAdjustment,
  undoResolution,
  balanceCorrection,
  remaining,
  observedResidual,
  closeExplanation,
  type Workspace,
} from './domain'
import { hasPendingExplanation } from './tasks'
const now = '2026-10-08T12:00:00Z'
const cp = (
  state = emptyWorkspace('A', 'ARS'),
  id = 'cp',
  expected = 100000000,
  confirmed = 90000000,
  date = now
) =>
  addCheckpoint(state, {
    id,
    expected,
    confirmed,
    observedAt: date,
    includedMovementIds: [],
  })
const adj = (state = cp(), id = 'a') =>
  acceptAdjustment(state, {
    id,
    checkpointId: state.checkpoints.at(-1)!.id,
    currentExpected: state.checkpoints.at(-1)!.expected,
    now,
  })
const movement = (
  id = 'e',
  effect = -5000000,
  date = '2026-10-07T12:00:00Z'
) => ({
  id,
  kind: 'expense' as const,
  accountId: 'A',
  currency: 'ARS' as const,
  effect,
  occurredAt: date,
  includedBeforeCheckpoint: false,
})
const resolve = (state: Workspace, id = 'r', m = movement()) =>
  resolveAdjustment(state, {
    id,
    adjustmentId: state.adjustments.find((a) => !a.reversedAt)!.id,
    movement: m,
    now,
    confirmedIncludedInBalance: true,
  })
describe('QA de ciclos, edicion y cuentas consecutivas', () => {
  it('aplica, revierte y reaplica sin acumular saldo ni borrar auditoria', () => {
    let s = adj()
    for (let i = 0; i < 10; i++) {
      expect(100000000 + balanceCorrection(s)).toBe(90000000)
      s = reverseAdjustment(s, s.adjustments.at(-1)!.id, now)
      expect(balanceCorrection(s)).toBe(0)
      s = adj(s, 'a' + i)
    }
    expect(s.adjustments.length).toBe(11)
  })
  it('compensa 50k atrasados, descuenta 50k nuevos y observa otros 50k', () => {
    let s = resolve(adj())
    expect(90000000 + balanceCorrection(s)).toBe(85000000)
    s = cp(s, 'cp2', 85000000, 80000000, '2026-10-11T12:00:00Z')
    expect(observedResidual(s, s.checkpoints.at(-1)!)).toBe(-5000000)
    expect(remaining(s, s.adjustments[0])).toBe(-5000000)
    s = adj(s, 'a2')
    expect(balanceCorrection(s)).toBe(-10000000)
    expect(90000000 + balanceCorrection(s)).toBe(80000000)
  })
  it('desvincular mantiene el gasto y cambia el saldo; revincular restaura', () => {
    const resolved = resolve(adj())
    expect(95000000 + balanceCorrection(resolved)).toBe(90000000)
    const undo = undoResolution(resolved, 'r', now)
    expect(95000000 + balanceCorrection(undo)).toBe(85000000)
    const again = resolve(undo, 'r2')
    expect(95000000 + balanceCorrection(again)).toBe(90000000)
  })
  it('bloquea revertir ajuste con evidencia; exige desvincular primero', () => {
    const s = resolve(adj())
    expect(() => reverseAdjustment(s, 'a', now)).toThrow(
      'undo_resolutions_first'
    )
    expect(
      balanceCorrection(
        reverseAdjustment(undoResolution(s, 'r', now), 'a', now)
      )
    ).toBe(0)
  })
  it('modificar gasto luego de desvincular exige validar nuevamente importe', () => {
    const s = undoResolution(resolve(adj()), 'r', now)
    const modified = resolve(s, 'r2', movement('e', -7000000))
    expect(93000000 + balanceCorrection(modified)).toBe(90000000)
    expect(remaining(modified, modified.adjustments[0])).toBe(-3000000)
    expect(() => resolve(s, 'r3', movement('e', -11000000))).toThrow(
      'effect_exceeds_gap'
    )
  })
  it('borrar gasto luego de desvincular restaura ledger sin inventar explicacion', () => {
    const s = undoResolution(resolve(adj()), 'r', now)
    expect(100000000 + balanceCorrection(s)).toBe(90000000)
    expect(remaining(s, s.adjustments[0])).toBe(-10000000)
    expect(hasPendingExplanation(s)).toBe(true)
  })
  it('corregir saldo confirmado exige nueva observacion e historial', () => {
    let s = reverseAdjustment(adj(), 'a', now)
    s = cp(s, 'cp-corrected', 100000000, 95000000, '2026-10-08T12:01:00Z')
    s = adj(s, 'a-corrected')
    expect(balanceCorrection(s)).toBe(-5000000)
    expect(s.checkpoints).toHaveLength(2)
    expect(s.adjustments[0].reversedAt).toBeTruthy()
  })
  it('no aceptar observacion vieja despues de gasto nuevo', () => {
    expect(() =>
      acceptAdjustment(cp(), {
        id: 'a',
        checkpointId: 'cp',
        currentExpected: 95000000,
        now,
      })
    ).toThrow('balance_changed')
  })
  it('tres conciliaciones diferidas no suman diferencias', () => {
    let s = cp()
    s = cp(s, 'cp2', 100000000, 90000000, '2026-10-09T12:00:00Z')
    s = cp(s, 'cp3', 100000000, 90000000, '2026-10-10T12:00:00Z')
    expect(balanceCorrection(s)).toBe(0)
    s = adj(s)
    expect(balanceCorrection(s)).toBe(-10000000)
  })
  it('dos cuentas consecutivas conservan ajustes y borradores propios', () => {
    const a = adj()
    let b = cp(emptyWorkspace('B', 'ARS'), 'cpB', 20000000, 18000000)
    b = adj(b, 'aB')
    b = {
      ...b,
      draft: {
        amount: '2000',
        description: 'Prueba B',
        date: '2026-10-07',
        category: 'Otros',
      },
    }
    expect(balanceCorrection(a)).toBe(-10000000)
    expect(balanceCorrection(b)).toBe(-2000000)
    expect(a.draft).toBeNull()
    expect(b.draft?.description).toBe('Prueba B')
    expect(() =>
      resolveAdjustment(b, {
        id: 'r',
        adjustmentId: 'aB',
        movement: movement(),
        now,
        confirmedIncludedInBalance: true,
      })
    ).toThrow('wrong_account_or_currency')
  })
  it('ARS y USD no admiten compensacion cruzada', () => {
    const usd = adj(cp(emptyWorkspace('A', 'USD')))
    expect(() => resolve(usd)).toThrow('wrong_account_or_currency')
  })
  it('cerrar busqueda conserva dinero; revertir cambia dinero', () => {
    const s = closeExplanation(adj(), 'a')
    expect(balanceCorrection(s)).toBe(-10000000)
    expect(hasPendingExplanation(s)).toBe(false)
    expect(balanceCorrection(reverseAdjustment(s, 'a', now))).toBe(0)
  })
  it('error de fecha futura no escribe resolucion y fecha corregida si', () => {
    const s = adj()
    expect(() =>
      resolve(s, 'r', movement('e', -5000000, '2026-10-10T12:00:00Z'))
    ).toThrow('after_checkpoint')
    expect(s.resolutions).toHaveLength(0)
    expect(resolve(s).resolutions).toHaveLength(1)
  })
})
