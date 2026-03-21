import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { geminiModel } from '@/lib/gemini/client'
import { createExpensePrompt } from '@/lib/gemini/prompts'
import { ParsedExpenseSchema } from '@/lib/validation/schemas'
import { checkRateLimit } from '@/lib/rate-limit'

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
    const { input } = await request.json()

    if (!input || input.trim().length === 0) {
      return NextResponse.json({ is_valid: false, reason: 'Input vacío' })
    }

    const result = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: createExpensePrompt(input) }],
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
