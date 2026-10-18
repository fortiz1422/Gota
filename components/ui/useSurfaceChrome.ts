'use client'

import { useEffect, useId } from 'react'
import type { FormSurfaceVariant } from './FormSurfaceHeader'

const layers = new Map<string, { top: string; canvas: string }>()
let original: {
  html: string
  body: string
  theme: string | null
  meta: HTMLMetaElement
} | null = null

function paint() {
  if (!original) return
  const top = Array.from(layers.values()).at(-1)
  document.documentElement.style.backgroundColor = top?.canvas ?? original.html
  document.body.style.backgroundColor = top?.canvas ?? original.body
  if (top) original.meta.content = top.top
  else {
    if (original.theme === null) original.meta.remove()
    else original.meta.content = original.theme
    original = null
  }
}

/** Owns browser/safe-area colors only while an opted-in sheet is open. Nested sheets restore their parent. */
export function useSurfaceChrome(open: boolean, variant?: FormSurfaceVariant) {
  const id = useId()
  useEffect(() => {
    if (!open || !variant) return
    const css = getComputedStyle(document.documentElement)
    const color = (token: string) => css.getPropertyValue(token).trim()
    const canvas = color(
      variant === 'r' ? '--color-r-canvas' : '--color-bg-secondary'
    )
    if (!original) {
      let meta = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]'
      )
      const theme = meta?.getAttribute('content') ?? null
      if (!meta) {
        meta = document.createElement('meta')
        meta.name = 'theme-color'
        document.head.append(meta)
      }
      original = {
        html: document.documentElement.style.backgroundColor,
        body: document.body.style.backgroundColor,
        theme,
        meta,
      }
    }
    layers.set(id, {
      canvas,
      top: variant === 'r' ? canvas : color('--color-primary'),
    })
    paint()
    return () => {
      layers.delete(id)
      paint()
    }
  }, [id, open, variant])
}
