import { describe, expect, it } from 'vitest'
import { counterpartyApiErrorMessage, filterCounterpartyProfiles } from './ui'

const profiles = [
  { id: '1', display_name: 'Belmar', default_category: 'Supermercado', aliases: [{ id: 'a1', alias_value: 'BEL MARFER' }] },
  { id: '2', display_name: 'Panadería', default_category: 'Alimentos', aliases: [{ id: 'a2', alias_value: 'SAN JOSE SA' }] },
]

describe('counterparty alias agenda UI helpers', () => {
  it('preserves the loaded list for an empty search', () => {
    expect(filterCounterpartyProfiles(profiles, '')).toEqual(profiles)
  })

  it('searches canonical names and observed aliases case-insensitively', () => {
    expect(filterCounterpartyProfiles(profiles, 'panadería').map((item) => item.id)).toEqual(['2'])
    expect(filterCounterpartyProfiles(profiles, 'marfer').map((item) => item.id)).toEqual(['1'])
    expect(filterCounterpartyProfiles(profiles, 'inexistente')).toEqual([])
  })

  it('shows an explicit conflict instead of silently reassigning', () => {
    expect(counterpartyApiErrorMessage('alias_already_assigned', 'fallback'))
      .toBe('Ese alias ya está asignado a otro comercio.')
  })
})
