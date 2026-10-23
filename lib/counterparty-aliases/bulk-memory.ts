import type { CounterpartyAliasMatch } from './resolve'
import { normalizeCounterpartyAlias } from './normalize'

export interface MerchantMemory {
  enabled: boolean
  mode: 'new' | 'existing'
  name: string
  profileId: string
}
export interface MerchantProfileOption {
  id: string
  display_name: string
  default_category: string | null
}

export function merchantMemoryError(memory: MerchantMemory): string | null {
  if (!memory.enabled) return null
  if (memory.mode === 'existing')
    return memory.profileId ? null : 'Elegí el comercio guardado.'
  return memory.name.trim().length > 0 && memory.name.trim().length <= 100
    ? null
    : 'Completá el nombre del comercio (hasta 100 caracteres).'
}

/** Same profile/create, category/update and alias/reassign contract as ParsePreview.
 * Financial persistence and remembering are separate: retrying memory never re-sends an expense.
 */
export async function saveBulkMerchantMemory(
  input: {
    memory: MerchantMemory
    detectedAlias: string
    category: string
    match?: CounterpartyAliasMatch | null
    onProfileCreated: (id: string) => void
  },
  fetcher: typeof fetch = fetch
): Promise<void> {
  const invalid = merchantMemoryError(input.memory)
  if (invalid) throw new Error(invalid)
  normalizeCounterpartyAlias(input.detectedAlias)
  const send = async (url: string, method: string, body: unknown) => {
    const response = await fetcher(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok)
      throw new Error(
        'No pudimos recordar el comercio. El gasto ya está guardado.'
      )
    return response
  }
  let id = input.memory.profileId
  if (input.memory.mode === 'new') {
    const response = await send('/api/counterparty-profiles', 'POST', {
      display_name: input.memory.name.trim(),
      default_category: input.category,
    })
    const profile = (await response.json()) as { id?: string }
    if (!profile.id)
      throw new Error('No pudimos identificar el comercio creado.')
    id = profile.id
    input.onProfileCreated(id)
  } else {
    await send(
      `/api/counterparty-profiles/${encodeURIComponent(id)}`,
      'PATCH',
      { default_category: input.category }
    )
  }
  if (input.match?.match_type === 'exact') {
    if (input.match.profile_id === id) return
    await send(
      `/api/counterparty-aliases/${encodeURIComponent(input.match.alias_id)}`,
      'PATCH',
      { profile_id: id }
    )
  } else {
    await send(
      `/api/counterparty-profiles/${encodeURIComponent(id)}/aliases`,
      'POST',
      { alias_value: input.detectedAlias, source: 'receipt' }
    )
  }
}

export function planBulkMerchantMemory(
  entries: Array<{
    id: string
    detectedAlias: string
    category: string
    memory: MerchantMemory
  }>
) {
  const groups = new Map<string, { ids: string[]; signature: string }>()
  for (const entry of entries) {
    if (!entry.memory.enabled) continue
    const invalid = merchantMemoryError(entry.memory)
    if (invalid) throw new Error(invalid)
    const key = normalizeCounterpartyAlias(entry.detectedAlias)
    const signature = JSON.stringify([
      entry.category,
      entry.memory.mode,
      entry.memory.mode === 'new'
        ? entry.memory.name.trim()
        : entry.memory.profileId,
    ])
    const group = groups.get(key)
    if (group && group.signature !== signature)
      throw new Error(
        'Hay preferencias distintas para el mismo comercio. Elegí una sola antes de confirmar.'
      )
    if (group) group.ids.push(entry.id)
    else groups.set(key, { ids: [entry.id], signature })
  }
  return [...groups.values()].map((group) => group.ids)
}
