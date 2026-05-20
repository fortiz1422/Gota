import { describe, expect, it } from 'vitest'
import { buildReceiptInlineData } from './receipt-inline-data'

describe('buildReceiptInlineData', () => {
  it('convierte un archivo en inlineData para Gemini', async () => {
    const file = new File([new Uint8Array([71, 79, 84, 65])], 'ticket.png', {
      type: 'image/png',
    })

    await expect(buildReceiptInlineData(file)).resolves.toEqual({
      mimeType: 'image/png',
      data: 'R09UQQ==',
    })
  })
})
