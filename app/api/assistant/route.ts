import { NextResponse } from 'next/server'
import { buildAssistantFinancialContext } from '@/lib/assistant/context'
import {
  buildAssistantInstruction,
  historyToText,
  normalizeAssistantHistory,
} from '@/lib/assistant/prompt'
import { FF_GOTA_ASSISTANT } from '@/lib/flags'
import { geminiModel } from '@/lib/gemini/client'
import { captureRouteError } from '@/lib/observability/sentry'
import { checkRateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

function cleanModelText(text: string): string {
  return text
    .replace(/^```(?:markdown|text)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

export async function POST(request: Request) {
  if (!FF_GOTA_ASSISTANT) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!checkRateLimit(`assistant:${user.id}`, 8, 60_000)) {
    return NextResponse.json(
      { error: 'Demasiadas consultas al asistente. Espera un minuto y probá de nuevo.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    )
  }

  try {
    const body = await request.json()
    const question = String(body.question ?? '').trim()
    const history = normalizeAssistantHistory(body.history)

    if (!question) {
      return NextResponse.json({ error: 'Escribí una pregunta para el asistente.' }, { status: 400 })
    }

    if (question.length > 600) {
      return NextResponse.json(
        { error: 'La pregunta es demasiado larga. Probá con una consulta más corta.' },
        { status: 400 },
      )
    }

    const historyText = historyToText(history)
    const context = await buildAssistantFinancialContext({
      supabase,
      userId: user.id,
      question,
      historyText,
    })
    const instruction = buildAssistantInstruction(context.text)

    const result = await geminiModel.generateContent({
      contents: [
        {
          role: 'user',
          parts: [{ text: instruction }],
        },
        {
          role: 'model',
          parts: [{ text: 'Entendido. Voy a responder solo con esos datos.' }],
        },
        ...history.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        {
          role: 'user',
          parts: [{ text: question }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 450,
      },
    })

    const answer = cleanModelText(result.response.text())

    return NextResponse.json({
      answer:
        answer ||
        'No pude armar una respuesta con los datos disponibles. Probá reformulando la consulta.',
      detailIncluded: context.detailIncluded,
    })
  } catch (error) {
    captureRouteError(error, {
      route: 'POST /api/assistant',
      operation: 'assistant_chat',
    })
    console.error('Assistant error:', error)

    return NextResponse.json(
      { error: 'No pude consultar el asistente ahora. Probá de nuevo en unos segundos.' },
      { status: 500 },
    )
  }
}
