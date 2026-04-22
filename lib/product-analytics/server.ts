import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database'
import type { ProductEventName, ProductEventProperties } from './events'
import { sanitizeEventProperties } from './events'

type ProductEventOptions = {
  isAnonymous?: boolean
  path?: string | null
  sessionId?: string | null
}

export async function recordProductEvent(
  supabase: SupabaseClient<Database>,
  userId: string,
  eventName: ProductEventName,
  properties: ProductEventProperties = {},
  options: ProductEventOptions = {},
): Promise<boolean> {
  const { error } = await supabase.from('product_events').insert({
    user_id: userId,
    event_name: eventName,
    properties: sanitizeEventProperties(properties) as Json,
    session_id: options.sessionId ?? null,
    path: options.path?.slice(0, 180) ?? null,
    is_anonymous: options.isAnonymous ?? false,
  })

  if (error && process.env.NODE_ENV === 'development') {
    console.warn('Product event was not recorded:', error.message)
  }

  return !error
}
