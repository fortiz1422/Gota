import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  resolveCounterpartyAlias,
  type CounterpartyAliasCandidate,
  type CounterpartyAliasMatch,
} from './resolve'

export async function resolveSavedCounterparty(
  supabase: SupabaseClient<Database>,
  userId: string,
  aliasValue: string,
): Promise<CounterpartyAliasMatch | null> {
  return resolveCounterpartyAlias(userId, aliasValue, {
    findExact: async (ownerId, normalizedValue) => {
      const { data: alias, error: aliasError } = await supabase.from('counterparty_aliases')
        .select('id,profile_id,alias_value,normalized_value')
        .eq('user_id', ownerId).eq('normalized_value', normalizedValue).maybeSingle()
      if (aliasError || !alias) return null
      const { data: profile, error: profileError } = await supabase.from('counterparty_profiles')
        .select('id,display_name,default_category')
        .eq('id', alias.profile_id).eq('user_id', ownerId).maybeSingle()
      if (profileError || !profile) return null
      return {
        alias_id: alias.id,
        profile_id: profile.id,
        alias_value: alias.alias_value,
        normalized_value: alias.normalized_value,
        display_name: profile.display_name,
        default_category: profile.default_category as CounterpartyAliasCandidate['default_category'],
      }
    },
    findCandidates: async (ownerId) => {
      const { data: aliases, error: aliasError, count } = await supabase.from('counterparty_aliases')
        .select('id,profile_id,alias_value,normalized_value', { count: 'exact' })
        .eq('user_id', ownerId).limit(500)
      if (aliasError || !aliases || count === null || count > aliases.length || aliases.length === 0) return []

      const profileIds = [...new Set(aliases.map((alias) => alias.profile_id))]
      const { data: profiles, error: profileError } = await supabase.from('counterparty_profiles')
        .select('id,display_name,default_category')
        .eq('user_id', ownerId).in('id', profileIds)
      if (profileError || !profiles) return []

      const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
      return aliases.flatMap((alias) => {
        const profile = profilesById.get(alias.profile_id)
        if (!profile) return []
        return [{
          alias_id: alias.id,
          profile_id: profile.id,
          alias_value: alias.alias_value,
          normalized_value: alias.normalized_value,
          display_name: profile.display_name,
          default_category: profile.default_category as CounterpartyAliasCandidate['default_category'],
        }]
      })
    },
  })
}
