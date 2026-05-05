'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { TOUR_STEPS } from './tour-steps'
import { useTour } from '@/hooks/useTour'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export function TourOverlay() {
  const { currentStep, totalSteps, next, skip } = useTour()
  const [targetRect, setTargetRect] = useState<Rect | null>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const step = TOUR_STEPS[currentStep]

  const updateRect = useCallback(() => {
    if (!step) return
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (!el) {
      setTargetRect(null)
      return
    }
    const rect = el.getBoundingClientRect()
    setTargetRect({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    })
  }, [step])

  useEffect(() => {
    if (!step) return

    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Wait for scroll to complete before measuring
      const timer = setTimeout(updateRect, 350)
      return () => clearTimeout(timer)
    }
  }, [step, updateRect])

  useEffect(() => {
    updateRect()

    const handleScroll = () => updateRect()
    const handleResize = () => updateRect()
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)

    // ResizeObserver on target
    const el = step ? document.querySelector(`[data-tour="${step.target}"]`) : null
    if (el) {
      observerRef.current = new ResizeObserver(updateRect)
      observerRef.current.observe(el)
    }

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
      observerRef.current?.disconnect()
    }
  }, [step, updateRect])

  if (!step) return null

  const padding = 6
  const clipRect = targetRect
    ? {
        top: targetRect.top - padding - window.scrollY,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null

  const clipPath = clipRect
    ? `polygon(
        0% 0%, 0% 100%,
        ${clipRect.left}px 100%,
        ${clipRect.left}px ${clipRect.top}px,
        ${clipRect.left + clipRect.width}px ${clipRect.top}px,
        ${clipRect.left + clipRect.width}px ${clipRect.top + clipRect.height}px,
        ${clipRect.left}px ${clipRect.top + clipRect.height}px,
        ${clipRect.left}px 100%,
        100% 100%, 100% 0%
      )`
    : undefined

  // Tooltip positioning
  const tooltipStyle: React.CSSProperties = {}
  if (clipRect) {
    const centerX = clipRect.left + clipRect.width / 2
    tooltipStyle.left = Math.max(16, Math.min(centerX - 140, window.innerWidth - 296))

    if (step.position === 'bottom') {
      tooltipStyle.top = clipRect.top + clipRect.height + 12
    } else {
      tooltipStyle.top = clipRect.top - 12
      tooltipStyle.transform = 'translateY(-100%)'
    }
  }

  const isLastStep = currentStep === totalSteps - 1

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop with cutout */}
      <div
        className="absolute inset-0 bg-black/50 transition-all duration-300"
        style={{ clipPath }}
        onClick={skip}
      />

      {/* Tooltip */}
      {clipRect && (
        <div
          className="absolute z-[10000] w-[280px] rounded-card bg-bg-secondary p-4 shadow-lg"
          style={tooltipStyle}
        >
          <p className="text-sm font-semibold text-text-primary">{step.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{step.body}</p>

          {/* Step dots */}
          <div className="mt-3 flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStep ? 'w-4 bg-primary' : 'w-1.5 bg-border-subtle'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={skip}
              className="text-xs font-medium text-text-tertiary transition-colors hover:text-text-secondary"
            >
              Omitir
            </button>
            <button
              onClick={next}
              className="rounded-button bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-95"
            >
              {isLastStep ? 'Empezar' : 'Siguiente →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
