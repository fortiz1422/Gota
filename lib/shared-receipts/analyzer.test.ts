import { describe, expect, it, vi } from 'vitest'
import { createUniversalReceiptPrompt, generateUniversalReceiptProposal } from './analyzer'

describe('universal shared receipt analyzer', () => {
  it('instructs Gemini to classify all transaction types and return evidence-aware JSON', () => {
    const prompt = createUniversalReceiptPrompt()
    for (const type of ['purchase', 'income', 'own_transfer', 'third_party_transfer', 'card_payment', 'refund', 'yield', 'unknown']) {
      expect(prompt).toContain(type)
    }
    expect(prompt).toContain('insufficient_evidence')
    expect(prompt).toContain('card_last_four')
  })

  it('uses receipt inline data and strips markdown fences from Gemini JSON', async () => {
    const generateContent = vi.fn(async (request) => {
      expect(request.contents[0].parts[1]).toEqual({ inlineData: { mimeType: 'image/png', data: 'AQID' } })
      return {
        response: {
          text: () => '```json\n{"transaction_type":"unknown","confidence":0,"warnings":["insufficient_evidence"],"evidence":[]}\n```',
        },
      }
    })

    const proposal = await generateUniversalReceiptProposal(
      { mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) },
      { generateContent },
    )
    expect(proposal).toMatchObject({ transaction_type: 'unknown', amount: null, confidence: 0 })
  })
})
