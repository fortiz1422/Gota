'use client'

interface Props {
  current: number // 1-indexed
  total: number
}

export function WizardProgress({ current, total }: Props) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="h-0.5 w-full bg-border-subtle">
      <div
        className="h-full bg-primary transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
