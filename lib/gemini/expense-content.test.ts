import { describe, expect, it } from 'vitest'
import { buildExpenseContentParts } from './expense-content'
import { createExpensePrompt } from './prompts'

describe('createExpensePrompt', () => {
  it('mantiene el modo texto cuando solo hay input manual', () => {
    const prompt = createExpensePrompt({ input: 'cafe 2500' })

    expect(prompt).toContain('Input: "cafe 2500"')
    expect(prompt).toContain('Imagen adjunta: no')
    expect(prompt).toContain('Audio adjunto: no')
    expect(prompt).toContain('Si hay imagen')
    expect(prompt).toContain('Si el input termina con un numero standalone')
  })

  it('activa instrucciones de vision cuando hay captura adjunta', () => {
    const prompt = createExpensePrompt({ hasReceiptImage: true })

    expect(prompt).toContain('Imagen adjunta: si')
    expect(prompt).toContain('ticket o comprobante')
    expect(prompt).toContain('Si la imagen no alcanza para inferir un gasto valido')
  })

  it('activa instrucciones de audio cuando hay dictado adjunto', () => {
    const prompt = createExpensePrompt({ hasVoiceAudio: true })

    expect(prompt).toContain('Audio adjunto: si')
    expect(prompt).toContain('interpretalo como un usuario dictando un gasto')
    expect(prompt).toContain('Si el audio no describe un gasto valido')
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
    expect(parts[0]).toMatchObject({ text: expect.stringContaining('Imagen adjunta: si') })
    expect(parts[1]).toEqual({
      inlineData: {
        mimeType: 'image/png',
        data: 'ZmFrZS1iYXNlNjQ=',
      },
    })
  })

  it('arma parts multimodales cuando hay audio adjunto', () => {
    const parts = buildExpenseContentParts({
      hasVoiceAudio: true,
      voiceInlineData: {
        mimeType: 'audio/wav',
        data: 'ZmFrZS12b2ljZQ==',
      },
    })

    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatchObject({ text: expect.stringContaining('Audio adjunto: si') })
    expect(parts[1]).toEqual({
      inlineData: {
        mimeType: 'audio/wav',
        data: 'ZmFrZS12b2ljZQ==',
      },
    })
  })
})
