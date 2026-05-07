'use client'

import { useEffect, useRef, useState } from 'react'

type VoiceInputState = 'idle' | 'listening' | 'error' | 'unsupported'

interface SpeechRecognitionAlternativeLike {
  transcript: string
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike
}

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onend: ((event: Event) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onstart: ((event: Event) => void) | null
  abort: () => void
  start: () => void
  stop: () => void
}

interface SpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

interface UseVoiceInputOptions {
  lang?: string
  onTranscript: (text: string) => void
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

function mapSpeechError(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'No tenemos permiso para usar el micrófono.'
    case 'audio-capture':
      return 'No encontramos un micrófono disponible.'
    case 'language-not-supported':
      return 'Este navegador no soporta dictado en español.'
    case 'network':
      return 'Hubo un problema de conexión al transcribir la voz.'
    case 'no-speech':
      return 'No detectamos voz. Probá de nuevo.'
    default:
      return 'No pudimos transcribir tu voz. Probá de nuevo.'
  }
}

export function useVoiceInput({ lang = 'es-AR', onTranscript }: UseVoiceInputOptions) {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const [state, setState] = useState<VoiceInputState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsSupported(getSpeechRecognitionConstructor() !== null)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  const clearError = () => {
    setError(null)
    setState((current) => (current === 'error' ? 'idle' : current))
  }

  const start = (): boolean => {
    const Recognition = getSpeechRecognitionConstructor()

    if (!Recognition) {
      setIsSupported(false)
      setState('unsupported')
      setError('La voz no está disponible en este navegador.')
      return false
    }

    setError(null)

    const recognition = new Recognition()
    recognition.lang = lang
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setState('listening')
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? ''
      if (transcript) {
        onTranscript(transcript)
      }
    }

    recognition.onerror = (event) => {
      setState(event.error === 'language-not-supported' ? 'unsupported' : 'error')
      setError(mapSpeechError(event.error))
    }

    recognition.onend = () => {
      recognitionRef.current = null
      setState((current) => {
        if (current === 'error' || current === 'unsupported') return current
        return 'idle'
      })
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
      setIsSupported(true)
      return true
    } catch {
      setState('error')
      setError('No pudimos iniciar el micrófono.')
      recognitionRef.current = null
      return false
    }
  }

  const stop = () => {
    recognitionRef.current?.stop()
  }

  return {
    clearError,
    error,
    isListening: state === 'listening',
    isSupported,
    start,
    state,
    stop,
  }
}
