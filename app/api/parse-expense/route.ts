import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { buildExpenseContentParts } from '@/lib/gemini/expense-content'
import { geminiModel } from '@/lib/gemini/client'
import { buildReceiptInlineData } from '@/lib/gemini/receipt-inline-data'
import { buildVoiceInlineData } from '@/lib/gemini/voice-inline-data'
import { applyTextInputAmountFallback } from '@/lib/expense-parse-fallback'
import { parseTextExpenseFallback } from '@/lib/expense-text-parser'
import { todayAR } from '@/lib/format'
import { captureRouteError } from '@/lib/observability/sentry'
import { checkRateLimit } from '@/lib/rate-limit'
import { ParsedExpenseSchema } from '@/lib/validation/schemas'
import { enrichParsedExpensePreview } from '@/lib/counterparty-aliases/preview'
import { resolveSavedCounterparty } from '@/lib/counterparty-aliases/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  let input = ''
  let receiptInlineData: Awaited<ReturnType<typeof buildReceiptInlineData>> | null = null
  let voiceInlineData: Awaited<ReturnType<typeof buildVoiceInlineData>> | null = null

  try {
    const contentType = request.headers.get('content-type') || ''
    const isMultipart = contentType.includes('multipart/form-data')

    if (isMultipart) {
      const formData = await request.formData()
      input = String(formData.get('input') ?? '').trim()

      const receipt = formData.get('receipt')
      const voice = formData.get('voice')

      if (receipt instanceof File && receipt.size > 0) {
        receiptInlineData = await buildReceiptInlineData(receipt)
      }

      if (voice instanceof File && voice.size > 0) {
        voiceInlineData = await buildVoiceInlineData(voice)
      }
    } else {
      const body = await request.json()
      input = String(body.input ?? '').trim()
    }

    if (!input && !receiptInlineData && !voiceInlineData) {
      return NextResponse.json({ is_valid: false, reason: 'Input vacio' })
    }

    const result = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: buildExpenseContentParts({
            input,
            hasReceiptImage: Boolean(receiptInlineData),
            receiptInlineData,
            hasVoiceAudio: Boolean(voiceInlineData),
            voiceInlineData,
          }),
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    })

    const raw = result.response.text()
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(text)
    const rescued = input ? applyTextInputAmountFallback(input, parsed) : parsed
    const validated = ParsedExpenseSchema.parse(rescued)
    if (!validated.is_valid) return NextResponse.json(validated)

    // Alias memory is optional until the additive migration is installed.
    // Parser output remains the evidence source; metadata is added separately.
    let match = null
    try {
      match = await resolveSavedCounterparty(supabase, user.id, validated.description)
    } catch {
      // Existing financial parsing must keep working when alias reads fail.
    }
    return NextResponse.json(enrichParsedExpensePreview(validated, match))
  } catch (error) {
    captureRouteError(error, {
      route: 'POST /api/parse-expense',
      operation: 'parse_expense',
    })
    console.error('Parse expense error:', error)

    if (error instanceof ZodError) {
      return NextResponse.json({
        is_valid: false,
        reason: 'No pude interpretar ese gasto. Revisa que tenga descripcion y monto.',
      })
    }

    if (input && !receiptInlineData && !voiceInlineData) {
      const fallback = parseTextExpenseFallback(input, todayAR())
      if (!fallback.is_valid) return NextResponse.json(fallback)
      let match = null
      try {
        match = await resolveSavedCounterparty(supabase, user.id, fallback.description)
      } catch {
        // Alias memory is optional; local parsing must remain available.
      }
      return NextResponse.json(enrichParsedExpensePreview(fallback, match))
    }

    return NextResponse.json({
      is_valid: false,
      reason: 'Error al procesar. Revisa tu conexion e intenta de nuevo.',
    })
  }
}
