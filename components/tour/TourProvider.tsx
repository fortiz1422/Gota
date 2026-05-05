'use client'

import { createContext, useCallback, useEffect, useState } from 'react'
import { TOUR_STEPS } from './tour-steps'
import { TourOverlay } from './TourOverlay'

interface TourContextValue {
  isActive: boolean
  currentStep: number
  totalSteps: number
  next: () => void
  skip: () => void
}

export const TourContext = createContext<TourContextValue>({
  isActive: false,
  currentStep: 0,
  totalSteps: TOUR_STEPS.length,
  next: () => {},
  skip: () => {},
})

interface Props {
  children: React.ReactNode
  onboardingCompleted: boolean
  tourCompleted: boolean
}

export function TourProvider({ children, onboardingCompleted, tourCompleted }: Props) {
  const [isActive, setIsActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (onboardingCompleted && !tourCompleted) {
      const timer = setTimeout(() => setIsActive(true), 800)
      return () => clearTimeout(timer)
    }
  }, [onboardingCompleted, tourCompleted])

  const finish = useCallback(async (skipped: boolean) => {
    setIsActive(false)
    setCurrentStep(0)
    try {
      await fetch('/api/user-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tour_completed: true }),
      })
    } catch {
      // Silently fail — tour_completed will be retried on next session
    }
    // Analytics
    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: skipped ? 'tour_skipped' : 'tour_completed',
          properties: { step: currentStep },
        }),
      })
    } catch {
      // Best effort
    }
  }, [currentStep])

  const next = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      finish(false)
    }
  }, [currentStep, finish])

  const skip = useCallback(() => {
    finish(true)
  }, [finish])

  return (
    <TourContext.Provider
      value={{ isActive, currentStep, totalSteps: TOUR_STEPS.length, next, skip }}
    >
      {children}
      {isActive && <TourOverlay />}
    </TourContext.Provider>
  )
}
