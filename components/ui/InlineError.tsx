interface InlineErrorProps {
  message: string | null
  className?: string
}

export function InlineError({ message, className = '' }: InlineErrorProps) {
  if (!message) return null

  return (
    <div
      role="alert"
      className={`rounded-card border border-danger/20 bg-danger/10 px-3 py-2 text-xs font-medium text-danger ${className}`}
    >
      {message}
    </div>
  )
}
