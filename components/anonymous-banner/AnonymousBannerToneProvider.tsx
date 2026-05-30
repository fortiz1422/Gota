'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export type AnonymousBannerTone = 'default' | 'supporting'

type AnonymousBannerToneContextValue = {
  tone: AnonymousBannerTone
  setTone: (tone: AnonymousBannerTone) => void
}

const AnonymousBannerToneContext = createContext<AnonymousBannerToneContextValue | null>(null)

export function AnonymousBannerToneProvider({ children }: { children: ReactNode }) {
  const [tone, setTone] = useState<AnonymousBannerTone>('default')
  const value = useMemo(() => ({ tone, setTone }), [tone])

  return (
    <AnonymousBannerToneContext.Provider value={value}>
      {children}
    </AnonymousBannerToneContext.Provider>
  )
}

export function useAnonymousBannerTone() {
  const context = useContext(AnonymousBannerToneContext)

  if (!context) {
    throw new Error('useAnonymousBannerTone must be used within AnonymousBannerToneProvider')
  }

  return context
}
