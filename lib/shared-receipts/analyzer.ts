import { buildReceiptInlineData } from '@/lib/gemini/receipt-inline-data'
import { geminiModel } from '@/lib/gemini/client'
import { parseReceiptProposal, type ReceiptProposal } from './proposal'

interface GeminiGenerator {
  generateContent(request: {
    contents: Array<{
      role: string
      parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
    }>
    generationConfig: { temperature: number }
  }): Promise<{ response: { text(): string } }>
}

export function createUniversalReceiptPrompt(): string {
  return `Analiza la imagen como evidencia financiera, sin asumir que es un gasto.
Clasifica transaction_type como exactamente uno de: purchase, income, own_transfer, third_party_transfer, card_payment, refund, yield, unknown.
Devuelve SOLO JSON con estas claves:
{"transaction_type":"unknown","amount":null,"currency":null,"occurred_at":null,"merchant_or_counterparty":null,"payment_rail":null,"account_hint":null,"card_last_four":null,"installments":null,"reference":null,"category_suggestion":null,"confidence":0,"warnings":[],"evidence":[]}
Reglas:
- amount es positivo y currency usa ISO 4217 (ARS/USD cuando corresponda).
- occurred_at es ISO 8601 con offset; no inventes fecha, monto, moneda ni contraparte.
- payment_rail: cash, card, debit_card, credit_card, bank_transfer, wallet, unknown o null.
- card_last_four contiene solo los ultimos 4 digitos. Nunca devuelvas tarjeta completa, CBU/CVU, CUIT/CUIL ni secretos.
- category_suggestion debe ser una categoria canonica de Gota o null.
- evidence contiene fragmentos visuales breves que justifican campos, sin identificadores sensibles completos.
- Si la evidencia no alcanza, usa null, transaction_type unknown cuando corresponda, baja confidence y agrega insufficient_evidence a warnings.`
}

export async function generateUniversalReceiptProposal(
  input: { mimeType: string; bytes: Uint8Array },
  model: GeminiGenerator = geminiModel,
): Promise<ReceiptProposal> {
  const file = new File([Buffer.from(input.bytes)], 'shared-receipt', { type: input.mimeType })
  const inlineData = await buildReceiptInlineData(file)
  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [{ text: createUniversalReceiptPrompt() }, { inlineData }],
      },
    ],
    generationConfig: { temperature: 0.1 },
  })
  const raw = result.response.text().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return parseReceiptProposal(JSON.parse(raw))
}
