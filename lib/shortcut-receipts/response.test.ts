import { describe, expect, it } from 'vitest'
import { withShortcutReceiptMessage } from './response'

describe('shortcut receipt response messages', () => {
  it('explains API errors without removing their technical code', () => {
    expect(withShortcutReceiptMessage({ error: 'unsupported_media_type' })).toEqual({
      error: 'unsupported_media_type',
      message: 'El archivo no es una imagen compatible. Usá JPG, PNG o WebP.',
    })
  })

  it('preserves an existing contextual message', () => {
    expect(withShortcutReceiptMessage({
      status: 'duplicate',
      receipt_id: 'receipt-1',
      message: 'Este comprobante ya estaba cargado y confirmado en Gota.',
    })).toEqual({
      status: 'duplicate',
      receipt_id: 'receipt-1',
      message: 'Este comprobante ya estaba cargado y confirmado en Gota.',
    })
  })
})
