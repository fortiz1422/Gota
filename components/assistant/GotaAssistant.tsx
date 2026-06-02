'use client'

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { ChatCircleDots, PaperPlaneRight, Sparkle, X } from '@phosphor-icons/react'
import type { AssistantHistoryMessage } from '@/lib/assistant/prompt'

type ChatMessage = AssistantHistoryMessage & {
  id: string
}

const SUGGESTIONS = [
  'En que estoy gastando mas este mes?',
  'Cuanto me queda disponible?',
  'Donde podria recortar gastos?',
]

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function buildHistory(messages: ChatMessage[]): AssistantHistoryMessage[] {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-6)
    .map((message) => ({ role: message.role, content: message.content }))
}

export function GotaAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const hasMessages = messages.length > 0
  const canSend = draft.trim().length > 0 && !loading

  useEffect(() => {
    function onComposer(event: Event) {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail
      setComposerOpen(Boolean(detail?.open))
    }

    setComposerOpen(document.documentElement.dataset.bottomComposer === 'open')
    window.addEventListener('gota:bottom-composer', onComposer)
    return () => window.removeEventListener('gota:bottom-composer', onComposer)
  }, [])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => {
      document.body.style.overflow = previousOverflow
      window.clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const panelTitle = useMemo(() => {
    if (loading) return 'Analizando tus datos'
    return 'Gota Asistente'
  }, [loading])

  async function sendQuestion(rawQuestion?: string) {
    const question = (rawQuestion ?? draft).trim()
    if (!question || loading) return

    const outgoing: ChatMessage = { id: newId(), role: 'user', content: question }
    const history = buildHistory(messages)

    setMessages((current) => [...current, outgoing])
    setDraft('')
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'No pude consultar el asistente.')
      }

      const answer = String(payload.answer ?? '').trim()
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: 'assistant',
          content: answer || 'No pude armar una respuesta con los datos disponibles.',
        },
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No pude consultar el asistente.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendQuestion()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendQuestion()
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Abrir Gota Asistente"
        onClick={() => setOpen(true)}
        className={`fixed right-4 z-[60] grid h-12 w-12 place-items-center rounded-full bg-[color:var(--color-primary)] text-white shadow-lg transition ${
          open || composerOpen ? 'pointer-events-none translate-y-2 opacity-0' : 'opacity-100'
        }`}
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 104px)' }}
      >
        <ChatCircleDots size={24} weight="duotone" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(13,24,41,0.34)] px-0 sm:items-center sm:px-4">
          <button
            type="button"
            aria-label="Cerrar Gota Asistente"
            className="absolute inset-0 h-full w-full"
            onClick={() => setOpen(false)}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="gota-assistant-title"
            className="relative flex h-[88dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[22px] border border-[color:var(--color-border-ocean)] bg-[color:var(--color-bg-tertiary)] shadow-lg sm:h-[720px] sm:max-h-[86dvh] sm:rounded-[22px]"
          >
            <header className="flex items-center justify-between border-b border-[color:var(--color-separator)] bg-[rgba(255,255,255,0.76)] px-4 py-3 backdrop-blur-xl">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)]">
                    <Sparkle size={18} weight="duotone" />
                  </span>
                  <div>
                    <h2 id="gota-assistant-title" className="text-[15px] font-bold text-[color:var(--color-text-primary)]">
                      {panelTitle}
                    </h2>
                    <p className="text-[12px] font-medium text-[color:var(--color-text-tertiary)]">
                      Basado en tus datos reales
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/70 text-[color:var(--color-text-secondary)]"
              >
                <X size={18} />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {!hasMessages && (
                <div className="space-y-3 pt-2">
                  <div className="surface-glass-neutral rounded-[18px] p-4 text-[14px] font-medium leading-relaxed text-[color:var(--color-text-secondary)]">
                    Preguntame por tendencias, categorias, compromisos o movimientos puntuales.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => void sendQuestion(suggestion)}
                        className="rounded-full border border-[color:var(--color-border-ocean)] bg-white/70 px-3 py-2 text-left text-[12px] font-bold text-[color:var(--color-primary)] shadow-sm"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[82%] rounded-[18px] px-4 py-3 text-[14px] font-medium leading-relaxed ${
                      message.role === 'user'
                        ? 'bg-[color:var(--color-primary)] text-white'
                        : 'surface-glass-neutral text-[color:var(--color-text-primary)]'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="surface-glass-neutral flex items-center gap-2 rounded-[18px] px-4 py-3 text-[13px] font-bold text-[color:var(--color-text-secondary)]">
                    <span className="spinner h-4 w-4" />
                    Pensando
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-[14px] border border-[color:var(--color-danger-light)] bg-[color:var(--color-danger-light)] px-3 py-2 text-[12px] font-bold text-[color:var(--color-danger)]">
                  {error}
                </div>
              )}
            </div>

            <form
              onSubmit={onSubmit}
              className="border-t border-[color:var(--color-separator)] bg-[rgba(255,255,255,0.86)] px-4 py-3 backdrop-blur-xl"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
            >
              <div className="flex items-end gap-2 rounded-[18px] border border-[color:var(--color-border-ocean)] bg-white px-3 py-2 shadow-sm">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  maxLength={600}
                  placeholder="Preguntame sobre tus finanzas..."
                  className="max-h-28 min-h-9 flex-1 resize-none border-0 bg-transparent px-0 py-2 text-[16px] font-medium text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-muted)] focus:ring-0"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Enviar pregunta"
                  className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--color-primary)] text-white transition disabled:bg-[color:var(--color-text-disabled)]"
                >
                  <PaperPlaneRight size={18} weight="fill" />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
