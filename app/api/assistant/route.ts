import { NextResponse } from 'next/server'
import { normalizeAssistantHistory } from '@/lib/assistant/prompt'
import { FF_GOTA_ASSISTANT } from '@/lib/flags'
import { geminiModel } from '@/lib/gemini/client'
import { buildAnswerPacket } from '@/lib/intelligence/chat-evidence'
import { planChatQuery } from '@/lib/intelligence/chat-planner'
import { buildAssistantInstructionV2 } from '@/lib/intelligence/chat-prompt'
import { loadFinancialSnapshot } from '@/lib/intelligence/snapshot'
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

    const snapshot = await loadFinancialSnapshot({ supabase, userId: user.id })
    const plan = planChatQuery(question)
    const packet = buildAnswerPacket(snapshot, plan)
    const instruction = buildAssistantInstructionV2(packet, snapshot)

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
        maxOutputTokens: 500,
      },
    })

    const answer = cleanModelText(result.response.text())

    // "Basado en tus datos" muestra los hechos que sostienen la respuesta
    // según el intent, no los primeros del packet.
    const evidence = packet.answerEvidenceIds
      .map((id) => packet.facts.find((fact) => fact.id === id))
      .filter((fact): fact is NonNullable<typeof fact> => fact !== undefined)
      .slice(0, 4)

    return NextResponse.json({
      answer:
        answer ||
        'No pude armar una respuesta con los datos disponibles. Probá reformulando la consulta.',
      detailIncluded: packet.movements.length > 0,
      intent: plan.intent,
      evidence,
      followUps: packet.followUps,
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
