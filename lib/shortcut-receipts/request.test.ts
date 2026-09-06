import { describe, expect, it } from 'vitest'
import { parseShortcutReceiptRequest } from './request'

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01])

describe('shortcut receipt request parsing', () => {
  it('accepts a raw image body from iOS Shortcuts', async () => {
    const request = new Request('https://gota.test/api/shortcut/v1/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Blob([jpeg]),
    })

    const result = await parseShortcutReceiptRequest(request)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.file).toMatchObject({
      name: 'shortcut-upload.jpg',
      type: 'image/jpeg',
      size: jpeg.byteLength,
    })
    expect(new Uint8Array(await result.file.arrayBuffer())).toEqual(jpeg)
  })

  it('keeps requiring exactly one file for multipart requests', async () => {
    const request = new Request('https://gota.test/api/shortcut/v1/receipts', {
      method: 'POST',
      body: new FormData(),
    })

    await expect(parseShortcutReceiptRequest(request)).resolves.toEqual({
      ok: false,
      status: 400,
      error: 'one_file_required',
    })
  })

  it('rejects a raw body that is not an image', async () => {
    const request = new Request('https://gota.test/api/shortcut/v1/receipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: 'not an image',
    })

    await expect(parseShortcutReceiptRequest(request)).resolves.toEqual({
      ok: false,
      status: 415,
      error: 'unsupported_media_type',
    })
  })
})
