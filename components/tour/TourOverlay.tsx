'use client'

import { useEffect, useRef, useState } from 'react'
import { TOUR_STEPS } from './tour-steps'
import { placeTourMessage, type TourRect } from './tour-position'
import { useTour } from '@/hooks/useTour'

export function TourOverlay() {
  const { currentStep, totalSteps, next, skip } = useTour()
  const step = TOUR_STEPS[currentStep]
  const messageRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const skipRef = useRef(skip)
  useEffect(() => {
    skipRef.current = skip
  }, [skip])
  const [geometry, setGeometry] = useState<{
    step: number
    target: TourRect | null
    width: number
    height: number
    messageHeight: number
    hidden: boolean
  } | null>(null)

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') skipRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (!step) return
    let frame = 0
    let observed: Element | null = null
    let focused = false
    const resize = new ResizeObserver(schedule)
    function measure() {
      const target = document.querySelector(`[data-tour="${step.target}"]`)
      if (target !== observed) {
        if (observed) resize.unobserve(observed)
        observed = target
        if (target) {
          resize.observe(target)
          const bounds = target.getBoundingClientRect()
          if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
            target.scrollIntoView({ block: 'center', behavior: 'instant' })
          }
        }
      }
      const rect = target?.getBoundingClientRect()
      setGeometry({
        step: currentStep,
        target:
          rect && rect.width > 0 && rect.height > 0
            ? {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
              }
            : null,
        width: window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
        messageHeight: messageRef.current?.offsetHeight ?? 230,
        hidden: document.documentElement.dataset.bottomComposer === 'open',
      })
      if (!focused && target) {
        nextRef.current?.focus({ preventScroll: true })
        focused = Boolean(nextRef.current)
      }
    }
    function schedule() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const mutation = new MutationObserver(schedule)
    mutation.observe(document.body, { childList: true, subtree: true })
    if (messageRef.current) resize.observe(messageRef.current)
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('gota:bottom-composer', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      mutation.disconnect()
      resize.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('gota:bottom-composer', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [currentStep, step])

  useEffect(() => {
    if (!messageRef.current || geometry?.step !== currentStep) return
    nextRef.current?.focus({ preventScroll: true })
    const message = messageRef.current
    const observer = new ResizeObserver(() => {
      const height = message.offsetHeight
      setGeometry((current) =>
        current && current.messageHeight !== height
          ? { ...current, messageHeight: height }
          : current
      )
    })
    observer.observe(message)
    return () => observer.disconnect()
  }, [geometry?.step, currentStep])

  if (!step || !geometry || geometry.step !== currentStep || geometry.hidden)
    return null
  const { target } = geometry
  const position = target
    ? placeTourMessage(target, geometry, geometry.messageHeight, step.position)
    : { width: Math.min(320, geometry.width - 24), left: 12, top: 80 }
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999]">
      {target && (
        <div
          aria-hidden="true"
          className="border-primary absolute rounded-2xl border-2"
          style={{
            top: target.top - 5,
            left: target.left - 5,
            width: target.width + 10,
            height: target.height + 10,
          }}
        />
      )}
      <div
        ref={messageRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-message-title"
        aria-describedby="tour-message-body"
        className="border-border-subtle bg-bg-secondary pointer-events-auto absolute rounded-2xl border p-4 shadow-lg"
        style={position}
      >
        <p className="text-text-dim text-[11px] font-medium">
          GUÍA RÁPIDA · {currentStep + 1} DE {totalSteps}
        </p>
        <h2
          id="tour-message-title"
          className="text-text-primary mt-2 text-[16px] font-semibold"
        >
          {step.title}
        </h2>
        <p
          id="tour-message-body"
          className="text-text-secondary mt-2 text-[13px] leading-5"
        >
          {target
            ? step.body
            : 'Esta sección no está visible ahora. Podés seguir con la guía u omitirla.'}
        </p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={skip}
            className="text-text-secondary min-h-11 px-1 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Omitir
          </button>
          <button
            ref={nextRef}
            type="button"
            onClick={next}
            className="rounded-button bg-primary min-h-11 px-4 text-[13px] font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {currentStep === totalSteps - 1 ? 'Listo' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>
  )
}
