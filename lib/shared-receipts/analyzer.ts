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
- Respeta el formato monetario argentino: el punto separa miles y la coma separa decimales. Por ejemplo, $4.100 significa 4100 ARS y $30.240,78 significa 30240.78 ARS.
- occurred_at es ISO 8601 con offset; no inventes fecha, monto, moneda ni contraparte.
- En comprobantes MODO, "Para <nombre>" identifica al destinatario y "Transferencia de <nombre>" identifica al emisor. merchant_or_counterparty debe ser el destinatario de una transferencia saliente, no el emisor.
- En comprobantes MODO, "Pagaste a <nombre>" es una compra (purchase); ese nombre es merchant_or_counterparty. Determina el medio por la fuente visible: si muestra una cuenta bancaria y no muestra ninguna tarjeta, payment_rail debe ser bank_transfer; solo usa debit_card o credit_card cuando la tarjeta esté explícitamente visible.
- La frase "A su cuenta" debajo del destinatario se refiere a la cuenta de ese destinatario. Si emisor y destinatario son personas diferentes, clasifica third_party_transfer, no own_transfer.
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
