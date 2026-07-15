'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Bell } from '@phosphor-icons/react'
import type { SignalBellTone } from '@/lib/intelligence/signal-center'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  tone: SignalBellTone
}

const DOT_CLASS: Record<Exclude<SignalBellTone, 'none'>, string> = {
  new: 'bg-data',
  watch: 'bg-warning',
  risk: 'bg-danger',
}

export const SignalsBellButton = forwardRef<HTMLButtonElement, Props>(
  function SignalsBellButton({ tone, className = '', ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={tone === 'none' ? 'Abrir Señales' : 'Abrir Señales, hay novedades'}
        className={`header-glass relative grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition-opacity hover:opacity-85 active:opacity-70 ${className}`}
        {...props}
      >
        <Bell size={18} weight="regular" aria-hidden="true" />
        {tone !== 'none' && (
          <span
            className={`absolute right-[7px] top-[6px] h-2 w-2 rounded-full ring-2 ring-white/80 ${DOT_CLASS[tone]}`}
            aria-hidden="true"
          />
        )}
      </button>
    )
  },
)
