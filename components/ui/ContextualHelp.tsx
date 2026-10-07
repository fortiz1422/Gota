import type { ReactNode } from 'react'

/** User-opened help: stays out of the way and can always be consulted again. */
export function ContextualHelp({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="my-2 text-text-secondary">
      <summary className="min-h-11 cursor-pointer rounded-button py-3 text-xs font-semibold text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2">
        {title}
      </summary>
      <div className="space-y-2 pb-3 text-sm leading-5">{children}</div>
    </details>
  )
}
