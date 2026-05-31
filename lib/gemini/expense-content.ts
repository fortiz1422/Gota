import { createExpensePrompt } from './prompts'

interface ReceiptInlineData {
  mimeType: string
  data: string
}

interface VoiceInlineData {
  mimeType: string
  data: string
}

interface BuildExpenseContentPartsArgs {
  input?: string
  hasReceiptImage?: boolean
  receiptInlineData?: ReceiptInlineData | null
  hasVoiceAudio?: boolean
  voiceInlineData?: VoiceInlineData | null
}

export function buildExpenseContentParts({
  input,
  hasReceiptImage = false,
  receiptInlineData = null,
  hasVoiceAudio = false,
  voiceInlineData = null,
}: BuildExpenseContentPartsArgs) {
  const parts: Array<{ text: string } | { inlineData: ReceiptInlineData | VoiceInlineData }> = [
    {
      text: createExpensePrompt({
        input,
        hasReceiptImage,
        hasVoiceAudio,
      }),
    },
  ]

  if (voiceInlineData) {
    parts.push({ inlineData: voiceInlineData })
  }

  if (receiptInlineData) {
    parts.push({ inlineData: receiptInlineData })
  }

  return parts
}
