import { describe, expect, it } from 'vitest'
import { buildExpenseContentParts } from './expense-content'
import { createExpensePrompt } from './prompts'

describe('createExpensePrompt', () => {
  it('mantiene el modo texto cuando solo hay input manual', () => {
    const prompt = createExpensePrompt({ input: 'cafe 2500' })

    expect(prompt).toContain('Input: "cafe 2500"')
    expect(prompt).toContain('Imagen adjunta: no')
    expect(prompt).toContain('Si hay imagen')
  })

  it('activa instrucciones de vision cuando hay captura adjunta', () => {
    const prompt = createExpensePrompt({ hasReceiptImage: true })

    expect(prompt).toContain('Imagen adjunta: sí')
    expect(prompt).toContain('ticket o comprobante')
    expect(prompt).toContain('Si la imagen no alcanza para inferir un gasto válido')
  })
})

describe('buildExpenseContentParts', () => {
  it('arma parts multimodales cuando hay una imagen adjunta', () => {
    const parts = buildExpenseContentParts({
      hasReceiptImage: true,
      receiptInlineData: {
        mimeType: 'image/png',
        data: 'ZmFrZS1iYXNlNjQ=',
      },
    })

    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatchObject({ text: expect.stringContaining('Imagen adjunta: sí') })
    expect(parts[1]).toEqual({
      inlineData: {
        mimeType: 'image/png',
        data: 'ZmFrZS1iYXNlNjQ=',
      },
    })
  })
})
