'use client'

import {
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type InputHTMLAttributes,
} from 'react'

/** Keeps the entire formatted amount visible; parsing remains the caller's responsibility. */
export const FittedAmountInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    maxFontSize?: number
    fit?: 'line' | 'field'
  }
>(function FittedAmountInput(
  { value, style, maxFontSize = 44, fit = 'line', ...props },
  forwardedRef
) {
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(forwardedRef, () => inputRef.current!, [])
  useLayoutEffect(() => {
    const input = inputRef.current
    const parent = input?.parentElement
    if (!input || !parent) return
    const measure = () => {
      const css = getComputedStyle(input)
      const parentCSS = getComputedStyle(parent)
      const padding = parseFloat(css.paddingLeft) + parseFloat(css.paddingRight)
      const siblings = Array.from(parent.children).filter(
        (node) => node !== input
      )
      const available =
        fit === 'field'
          ? input.clientWidth
          : parent.clientWidth -
            parseFloat(parentCSS.paddingLeft) -
            parseFloat(parentCSS.paddingRight) -
            siblings.reduce(
              (sum, node) => sum + node.getBoundingClientRect().width,
              0
            ) -
            (parseFloat(parentCSS.columnGap) || 0) * siblings.length
      if (available <= padding) return
      const context = document.createElement('canvas').getContext('2d')
      if (!context) return
      const text = String(value || props.placeholder || '0')
      context.font = `${css.fontWeight} ${maxFontSize}px ${css.fontFamily}`
      // Keep a little room for rounding, the caret and native input painting.
      const width = context.measureText(text).width
      const size = Math.min(
        maxFontSize,
        Math.max(
          12,
          (maxFontSize * (available - padding - 6)) / Math.max(width, 1)
        )
      )
      input.style.fontSize = `${size}px`
      if (fit === 'line')
        input.style.width = `${Math.min(available, (width * size) / maxFontSize + padding + 6)}px`
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    void document.fonts.ready.then(measure)
    return () => observer.disconnect()
  }, [value, maxFontSize, fit, props.placeholder])
  return (
    <input
      {...props}
      value={value}
      ref={inputRef}
      data-fitted-amount
      style={style}
    />
  )
})
