interface VoiceInlineData {
  mimeType: string
  data: string
}

export async function buildVoiceInlineData(file: File): Promise<VoiceInlineData> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return {
    mimeType: file.type || 'audio/wav',
    data: buffer.toString('base64'),
  }
}
