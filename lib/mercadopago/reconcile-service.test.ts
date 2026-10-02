import { describe, expect, it } from 'vitest'
import { closedMercadoPagoReconciliationWindow } from './reconcile-service'
describe('closed Argentine reconciliation windows',()=>{
 it('never requests the still-open Argentine day even after UTC midnight',()=>{
  const now=new Date('2026-10-02T01:30:00Z')
  const window=closedMercadoPagoReconciliationWindow(now)
  expect(window.beginTimestamp).toBe('2026-09-28T03:00:00Z')
  expect(window.endTimestamp).toBe('2026-10-01T02:59:59Z')
  expect(Date.parse(window.endTimestamp)).toBeLessThan(now.getTime())
 })
 it('advances once Argentina has finished the day',()=>{
  expect(closedMercadoPagoReconciliationWindow(new Date('2026-10-02T03:01:00Z')).endTimestamp).toBe('2026-10-02T02:59:59Z')
 })
})
