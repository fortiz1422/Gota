import { describe, expect, it } from 'vitest'
import { planBulkMerchantMemory, type MerchantMemory } from './bulk-memory'
const memory: MerchantMemory = {
  enabled: true,
  mode: 'new',
  name: 'Pollería del barrio',
  profileId: '',
}
const entry = (id: string) => ({
  id,
  detectedAlias: 'Juliana Farías',
  category: 'Alimentos',
  memory,
})
describe('one remembered preference per merchant in a batch', () => {
  it('groups identical choices so repeated receipts do not create duplicate profiles', () => {
    expect(
      planBulkMerchantMemory([
        entry('one'),
        { ...entry('two'), detectedAlias: 'JULIANA FARIAS' },
      ])
    ).toEqual([['one', 'two']])
  })
  it('blocks conflicting future preferences before any financial write', () => {
    expect(() =>
      planBulkMerchantMemory([
        entry('one'),
        { ...entry('two'), category: 'Otros' },
      ])
    ).toThrow('preferencias distintas')
  })
  it('does not treat category application as permission to remember an alias', () => {
    expect(
      planBulkMerchantMemory([
        { ...entry('one'), memory: { ...memory, enabled: false } },
      ])
    ).toEqual([])
  })
})
