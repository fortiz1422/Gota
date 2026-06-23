import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { buildExpenseContentParts } from '@/lib/gemini/expense-content'
import { geminiModel } from '@/lib/gemini/client'
import { buildReceiptInlineData } from '@/lib/gemini/receipt-inline-data'
import { buildVoiceInlineData } from '@/lib/gemini/voice-inline-data'
import { applyTextInputAmountFallback } from '@/lib/expense-parse-fallback'
import { captureRouteError } from '@/lib/observability/sentry'
import { checkRateLimit } from '@/lib/rate-limit'
import { ParsedExpenseSchema } from '@/lib/validation/schemas'

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

  try {
    const contentType = request.headers.get('content-type') || ''
    const isMultipart = contentType.includes('multipart/form-data')

    let input = ''
    let receiptInlineData: Awaited<ReturnType<typeof buildReceiptInlineData>> | null = null
    let voiceInlineData: Awaited<ReturnType<typeof buildVoiceInlineData>> | null = null

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

    return NextResponse.json(validated)
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

    return NextResponse.json({
      is_valid: false,
      reason: 'Error al procesar. Revisa tu conexion e intenta de nuevo.',
    })
  }
}
