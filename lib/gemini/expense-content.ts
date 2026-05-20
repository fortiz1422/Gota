import { createExpensePrompt } from './prompts'

interface ReceiptInlineData {
  mimeType: string
  data: string
}

interface BuildExpenseContentPartsArgs {
  input?: string
  hasReceiptImage?: boolean
  receiptInlineData?: ReceiptInlineData | null
}

export function buildExpenseContentParts({
  input,
  hasReceiptImage = false,
  receiptInlineData = null,
}: BuildExpenseContentPartsArgs) {
  const parts: Array<{ text: string } | { inlineData: ReceiptInlineData }> = [
    {
      text: createExpensePrompt({
        input,
        hasReceiptImage,
      }),
    },
  ]

  if (receiptInlineData) {
    parts.push({ inlineData: receiptInlineData })
  }

  return parts
}
