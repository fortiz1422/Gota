'use client'
import { createContext } from 'react'
// Opt-in only: legacy modals outside SettingsDetail keep their existing behavior.
export const NestedSettingsModalContext = createContext(false)
