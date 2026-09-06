import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { generateShortcutReceiptToken } from './token'

const MAX_ACTIVE_DEVICES = 5
const noStoreHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' } as const
const LabelSchema = z.string().trim().min(1).max(120)

export type SafeShortcutDevice = {
  id: string
  label: string
  created_at: string
  expires_at: string | null
  last_seen_at?: string | null
  revoked_at?: string | null
}

export type InsertShortcutDevice = {
  user_id: string
  label: string
  token_hash: string
  token_prefix: string
  scopes: ['receipt:write']
  expires_at: string
}

export interface ShortcutDeviceStore {
  countActive(userId: string): Promise<number>
  insert(input: InsertShortcutDevice): Promise<SafeShortcutDevice>
  list(userId: string): Promise<SafeShortcutDevice[]>
  revoke(userId: string, deviceId: string): Promise<boolean>
}

type HandlerResult = { status: number; body: unknown; headers: typeof noStoreHeaders }

function result(status: number, body: unknown): HandlerResult {
  return { status, body, headers: noStoreHeaders }
}

export function createDeviceHandlers(store: ShortcutDeviceStore) {
  return {
    async create(userId: string | null, body: unknown, origin: string): Promise<HandlerResult> {
      if (!userId) return result(401, { error: 'unauthorized' })
      const parsed = z.object({ label: LabelSchema }).safeParse(body)
      if (!parsed.success) return result(400, { error: 'invalid_request' })
      if ((await store.countActive(userId)) >= MAX_ACTIVE_DEVICES) {
        return result(409, { error: 'device_limit' })
      }
      const token = generateShortcutReceiptToken()
      const device = await store.insert({
        user_id: userId,
        label: parsed.data.label,
        token_hash: token.tokenHash,
        token_prefix: token.tokenPrefix,
        scopes: ['receipt:write'],
        expires_at: token.expiresAt,
      })
      return result(201, {
        device,
        token: token.rawToken,
        upload_url: `${origin}/api/shortcut/v1/receipts`,
      })
    },

    async list(userId: string | null): Promise<HandlerResult> {
      if (!userId) return result(401, { error: 'unauthorized' })
      return result(200, { devices: await store.list(userId) })
    },

    async revoke(userId: string | null, deviceId: string): Promise<HandlerResult> {
      if (!userId) return result(401, { error: 'unauthorized' })
      const revoked = await store.revoke(userId, deviceId)
      return revoked ? result(204, null) : result(404, { error: 'not_found' })
    },
  }
}

export function createSupabaseShortcutDeviceStore(
  supabase: SupabaseClient<Database>,
): ShortcutDeviceStore {
  return {
    async countActive(userId) {
      const now = new Date().toISOString()
      const { count, error } = await supabase
        .from('device_access_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .contains('scopes', ['receipt:write'])
        .is('revoked_at', null)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
      if (error) throw error
      return count ?? 0
    },

    async insert(input) {
      const { data, error } = await supabase
        .from('device_access_tokens')
        .insert(input)
        .select('id, label, created_at, expires_at, last_seen_at, revoked_at')
        .single()
      if (error) throw error
      return data
    },

    async list(userId) {
      const { data, error } = await supabase
        .from('device_access_tokens')
        .select('id, label, created_at, expires_at, last_seen_at, revoked_at')
        .eq('user_id', userId)
        .contains('scopes', ['receipt:write'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },

    async revoke(userId, deviceId) {
      const { data, error } = await supabase
        .from('device_access_tokens')
        .update({ revoked_at: new Date().toISOString(), revoked_reason: 'user_revoked' })
        .eq('id', deviceId)
        .eq('user_id', userId)
        .contains('scopes', ['receipt:write'])
        .is('revoked_at', null)
        .select('id')
        .maybeSingle()
      if (error) throw error
      return Boolean(data)
    },
  }
}
