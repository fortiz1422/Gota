export type SetupAccountType = 'bank' | 'digital' | 'cash'
export type SetupCurrency = 'ARS' | 'USD'
export type SetupAccount = {
  id: string
  name: string
  type: SetupAccountType
  opening_balance_ars: number
  opening_balance_usd: number
  is_primary?: boolean
}
export type AccountSetupInput = {
  name: string
  type: SetupAccountType
  currency: SetupCurrency
  balanceARS: number
  balanceUSD: number
}

// Argentine thousands separators, comma cents, or an ungrouped decimal dot.
// Empty is unknown, never silently zero.
export function parseSetupBalance(raw: string): number | null {
  const value = raw.trim()
  if (!value || !/^-?\d+(?:[.,]\d+)*$/.test(value)) return null
  let normalized: string
  if (value.includes(',')) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(value)) return null
    normalized = value.replaceAll('.', '').replace(',', '.')
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(value)) {
    normalized = value.replaceAll('.', '')
  } else {
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) return null
    normalized = value
  }
  const number = Number(normalized)
  return Number.isFinite(number) && Math.abs(number) < 10_000_000_000
    ? number
    : null
}

export async function saveAccountSetup(
  input: AccountSetupInput,
  options: {
    fetcher?: typeof fetch
    onAccountSaved: (account: SetupAccount) => void
  }
): Promise<void> {
  const fetcher = options.fetcher ?? fetch
  // Server derives a stable account id; retries/two tabs cannot create duplicates.
  const response = await fetcher('/api/onboarding-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name.trim(),
      type: input.type,
      opening_balance_ars: input.balanceARS,
      opening_balance_usd: input.balanceUSD,
    }),
  })
  if (!response.ok)
    throw new Error(
      'No pudimos guardar la cuenta. Revisá tu conexión y reintentá.'
    )
  const saved: SetupAccount & { completed?: boolean } = await response.json()
  if (saved.completed) return
  if (!saved?.id)
    throw new Error(
      'No pudimos confirmar el guardado. Reintentá para recuperar la cuenta.'
    )
  options.onAccountSaved(saved)

  const configResponse = await fetcher('/api/user-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      default_currency: input.currency,
      hero_balance_mode: 'default_currency',
      onboarding_completed: true,
      tour_completed: true,
    }),
  })
  if (!configResponse.ok)
    throw new Error(
      'Tu cuenta quedó guardada. Falta terminar la configuración: reintentá acá.'
    )
}
