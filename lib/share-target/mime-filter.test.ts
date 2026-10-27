import { describe, expect, it } from 'vitest'
import {
  isShareTargetReceiptImageFile,
  isShareTargetReceiptImageMime,
  shareTargetBridgeErrorMessage,
} from './mime-filter'

describe('share-target mime filter', () => {
  it('accepts image MIME types only', () => {
    expect(isShareTargetReceiptImageMime('image/png')).toBe(true)
    expect(isShareTargetReceiptImageMime('image/jpeg')).toBe(true)
    expect(isShareTargetReceiptImageMime('application/pdf')).toBe(false)
    expect(isShareTargetReceiptImageMime('')).toBe(false)
  })

  it('rejects files without an image MIME type', () => {
    expect(isShareTargetReceiptImageFile({ type: 'image/webp' })).toBe(true)
    expect(isShareTargetReceiptImageFile({ type: 'text/plain' })).toBe(false)
    expect(isShareTargetReceiptImageFile({ type: '' })).toBe(false)
  })

  it('maps invalid-type bridge errors to Spanish copy', () => {
    expect(shareTargetBridgeErrorMessage('tipo_invalido')).toContain('imágenes')
    expect(shareTargetBridgeErrorMessage(null)).toBeNull()
  })
})
