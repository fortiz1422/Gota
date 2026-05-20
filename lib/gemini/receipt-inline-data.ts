interface ReceiptInlineData {
  mimeType: string
  data: string
}

export async function buildReceiptInlineData(file: File): Promise<ReceiptInlineData> {
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return {
    mimeType: file.type || 'application/octet-stream',
    data: buffer.toString('base64'),
  }
}
