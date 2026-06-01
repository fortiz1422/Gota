'use client'

import { useEffect, useRef, useState } from 'react'

type VoiceInputState = 'idle' | 'recording' | 'processing' | 'error' | 'unsupported'

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext
  }
}

interface UseVoiceInputOptions {
  maxDurationMs?: number
  onAudioCaptured: (audioFile: File) => Promise<void> | void
}

interface RecorderSession {
  audioContext: AudioContext
  flushNode: GainNode
  processor: ScriptProcessorNode
  source: MediaStreamAudioSourceNode
  stream: MediaStream
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  return window.AudioContext ?? window.webkitAudioContext ?? null
}

function isVoiceInputSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(navigator.mediaDevices && getAudioContextConstructor())
}

function mapVoiceError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      return 'No tenemos permiso para usar el micrófono.'
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'No encontramos un micrófono disponible.'
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'No pudimos acceder al micrófono en este momento.'
    }
  }

  return 'No pudimos grabar tu voz. Probá de nuevo.'
}

function mergeFloat32Chunks(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }

  return merged
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2
  const blockAlign = bytesPerSample
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * bytesPerSample, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, samples.length * bytesPerSample, true)

  let offset = 44
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample))
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += bytesPerSample
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

async function cleanupRecorderSession(session: RecorderSession | null): Promise<void> {
  if (!session) return

  session.processor.disconnect()
  session.source.disconnect()
  session.flushNode.disconnect()
  session.stream.getTracks().forEach((track) => track.stop())
  await session.audioContext.close().catch(() => undefined)
}

export function useVoiceInput({
  maxDurationMs = 12000,
  onAudioCaptured,
}: UseVoiceInputOptions) {
  const recorderRef = useRef<RecorderSession | null>(null)
  const chunksRef = useRef<Float32Array[]>([])
  const maxDurationTimeoutRef = useRef<number | null>(null)
  const isStoppingRef = useRef(false)
  const [state, setState] = useState<VoiceInputState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsSupported(isVoiceInputSupported())
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (maxDurationTimeoutRef.current !== null) {
        window.clearTimeout(maxDurationTimeoutRef.current)
      }
      void cleanupRecorderSession(recorderRef.current)
      recorderRef.current = null
    }
  }, [])

  const clearError = () => {
    setError(null)
    setState((current) => (current === 'error' ? 'idle' : current))
  }

  const start = async (): Promise<boolean> => {
    const AudioContextConstructor = getAudioContextConstructor()

    if (!navigator.mediaDevices?.getUserMedia || !AudioContextConstructor) {
      setIsSupported(false)
      setState('unsupported')
      setError('La voz no está disponible en este navegador.')
      return false
    }

    if (state === 'recording' || state === 'processing') {
      return false
    }

    setError(null)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      })

      const audioContext = new AudioContextConstructor()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      const flushNode = audioContext.createGain()
      flushNode.gain.value = 0

      processor.onaudioprocess = (event) => {
        const channelData = event.inputBuffer.getChannelData(0)
        chunksRef.current.push(new Float32Array(channelData))
      }

      source.connect(processor)
      processor.connect(flushNode)
      flushNode.connect(audioContext.destination)

      recorderRef.current = {
        audioContext,
        flushNode,
        processor,
        source,
        stream,
      }

      setIsSupported(true)
      setState('recording')

      if (maxDurationTimeoutRef.current !== null) {
        window.clearTimeout(maxDurationTimeoutRef.current)
      }
      maxDurationTimeoutRef.current = window.setTimeout(() => {
        void stop()
      }, maxDurationMs)

      return true
    } catch (captureError) {
      setState('error')
      setError(mapVoiceError(captureError))
      await cleanupRecorderSession(recorderRef.current)
      recorderRef.current = null
      return false
    }
  }

  const stop = async (): Promise<void> => {
    if (isStoppingRef.current || state !== 'recording') return

    isStoppingRef.current = true

    if (maxDurationTimeoutRef.current !== null) {
      window.clearTimeout(maxDurationTimeoutRef.current)
      maxDurationTimeoutRef.current = null
    }

    const session = recorderRef.current
    recorderRef.current = null

    try {
      if (!session) {
        setState('idle')
        return
      }

      const sampleRate = session.audioContext.sampleRate
      await cleanupRecorderSession(session)

      const mergedSamples = mergeFloat32Chunks(chunksRef.current)
      chunksRef.current = []

      if (mergedSamples.length === 0) {
        setState('error')
        setError('No detectamos voz. Probá de nuevo.')
        return
      }

      setState('processing')
      const audioBlob = encodeWav(mergedSamples, sampleRate)
      const audioFile = new File([audioBlob], `voice-input-${Date.now()}.wav`, {
        type: audioBlob.type,
      })

      await onAudioCaptured(audioFile)
      setState('idle')
    } catch (processingError) {
      setState('error')
      setError(mapVoiceError(processingError))
    } finally {
      isStoppingRef.current = false
    }
  }

  return {
    clearError,
    error,
    isListening: state === 'recording',
    isProcessing: state === 'processing',
    isSupported,
    start,
    state,
    stop,
  }
}
