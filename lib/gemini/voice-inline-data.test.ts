import { describe, expect, it } from 'vitest'
import { buildVoiceInlineData } from './voice-inline-data'

describe('buildVoiceInlineData', () => {
  it('convierte un archivo de audio en inlineData para Gemini', async () => {
    const file = new File([new Uint8Array([71, 79, 84, 65])], 'voice.wav', {
      type: 'audio/wav',
    })

    await expect(buildVoiceInlineData(file)).resolves.toEqual({
      mimeType: 'audio/wav',
      data: 'R09UQQ==',
    })
  })
})
