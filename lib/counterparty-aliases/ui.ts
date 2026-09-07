export type CounterpartyAliasListItem = { id: string; alias_value: string }

export type CounterpartyProfileListItem = {
  id: string
  display_name: string
  default_category: string | null
  aliases: CounterpartyAliasListItem[]
}

export function filterCounterpartyProfiles<T extends CounterpartyProfileListItem>(
  profiles: T[],
  query: string,
): T[] {
  const normalized = query.trim().toLocaleLowerCase('es')
  if (!normalized) return profiles
  return profiles.filter((profile) =>
    profile.display_name.toLocaleLowerCase('es').includes(normalized)
    || profile.aliases.some((alias) => alias.alias_value.toLocaleLowerCase('es').includes(normalized)),
  )
}

export function counterpartyApiErrorMessage(error: unknown, fallback: string): string {
  if (error === 'alias_already_assigned') return 'Ese alias ya está asignado a otro comercio.'
  return typeof error === 'string' && error ? error : fallback
}
