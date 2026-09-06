import { describe, expect, it } from 'vitest'
import { createDeviceHandlers, type ShortcutDeviceStore } from './device-store'

function store(overrides: Partial<ShortcutDeviceStore> = {}): ShortcutDeviceStore {
  return {
    countActive: async () => 0,
    insert: async (input) => ({ id: 'device-1', label: input.label, created_at: 'now', expires_at: input.expires_at }),
    list: async () => [],
    revoke: async () => true,
    ...overrides,
  }
}

describe('shortcut receipt device handlers', () => {
  it('requires a session and issues only receipt:write without persisting raw token', async () => {
    const inserted: Record<string, unknown>[] = []
    const handlers = createDeviceHandlers(store({ insert: async (input) => {
      inserted.push(input)
      return { id: 'device-1', label: input.label, created_at: 'now', expires_at: input.expires_at }
    }}))
    expect((await handlers.create(null, { label: 'iPhone' }, 'https://gota.test')).status).toBe(401)
    const result = await handlers.create('user-1', { label: 'iPhone' }, 'https://gota.test')
    expect(result.status).toBe(201)
    expect(result.headers).toEqual({ 'Cache-Control': 'no-store', Pragma: 'no-cache' })
    expect(result.body).toMatchObject({ upload_url: 'https://gota.test/api/shortcut/v1/receipts' })
    expect((result.body as { token: string }).token).toMatch(/^gota_sr_v1_/)
    expect(inserted[0]).toMatchObject({ user_id: 'user-1', scopes: ['receipt:write'], label: 'iPhone' })
    expect(JSON.stringify(inserted[0])).not.toContain((result.body as { token: string }).token)
  })

  it('validates labels and caps active devices', async () => {
    const handlers = createDeviceHandlers(store({ countActive: async () => 5 }))
    expect((await handlers.create('user-1', { label: '' }, 'https://gota.test')).status).toBe(400)
    expect((await handlers.create('user-1', { label: 'iPhone' }, 'https://gota.test')).status).toBe(409)
  })

  it('lists only safe metadata and never re-exposes a token', async () => {
    const handlers = createDeviceHandlers(store({ list: async () => [{ id: 'd1', label: 'iPhone', created_at: 'now', expires_at: 'later', last_seen_at: null, revoked_at: null }] }))
    const result = await handlers.list('user-1')
    expect(result.status).toBe(200)
    expect(JSON.stringify(result.body)).not.toMatch(/token_hash|token_prefix|gota_sr/)
  })

  it('revokes by both user and device and fails closed on zero rows', async () => {
    let args: string[] = []
    const handlers = createDeviceHandlers(store({ revoke: async (userId, id) => { args = [userId, id]; return false } }))
    const result = await handlers.revoke('user-a', 'device-b')
    expect(args).toEqual(['user-a', 'device-b'])
    expect(result.status).toBe(404)
  })
})
