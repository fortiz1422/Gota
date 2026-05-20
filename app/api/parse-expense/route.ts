import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { buildExpenseContentParts } from '@/lib/gemini/expense-content'
import { geminiModel } from '@/lib/gemini/client'
import { buildReceiptInlineData } from '@/lib/gemini/receipt-inline-data'
import { ParsedExpenseSchema } from '@/lib/validation/schemas'
import { checkRateLimit } from '@/lib/rate-limit'
import { captureRouteError } from '@/lib/observability/sentry'

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
      { error: 'Demasiadas solicitudes. Esperá un momento.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    )
  }

  try {
    const contentType = request.headers.get('content-type') || ''
    const isMultipart = contentType.includes('multipart/form-data')

    let input = ''
    let receiptInlineData: Awaited<ReturnType<typeof buildReceiptInlineData>> | null = null

    if (isMultipart) {
      const formData = await request.formData()
      input = String(formData.get('input') ?? '').trim()
      const receipt = formData.get('receipt')
      if (receipt instanceof File && receipt.size > 0) {
        receiptInlineData = await buildReceiptInlineData(receipt)
      }
    } else {
      const body = await request.json()
      input = String(body.input ?? '').trim()
    }

    if (!input && !receiptInlineData) {
      return NextResponse.json({ is_valid: false, reason: 'Input vacío' })
    }

    const result = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: buildExpenseContentParts({
            input,
            hasReceiptImage: Boolean(receiptInlineData),
            receiptInlineData,
          }),
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    })

    const raw = result.response.text()
    // Strip markdown code fences if Gemini wraps the JSON
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const parsed = JSON.parse(text)
    const validated = ParsedExpenseSchema.parse(parsed)

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
        reason: 'No pude interpretar ese gasto. Revisá que tenga descripción y monto.',
      })
    }
    return NextResponse.json({
      is_valid: false,
      reason: 'Error al procesar. Revisá tu conexión e intentá de nuevo.',
    })
  }
}
