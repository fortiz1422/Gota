interface Props {
  tone?: 'onBlue'
  pct: number
  paceStatus: 'on_track' | 'behind' | 'no_date' | 'completed' | 'paused'
}

const TRACK_COLORS: Record<Props['paceStatus'], string> = {
  on_track: 'var(--color-success)',
  completed: 'var(--color-success)',
  behind: 'var(--color-warning)',
  no_date: 'var(--color-primary)',
  paused: 'var(--color-text-secondary)',
}

export function GoalProgressBar({ pct, paceStatus, tone }: Props) {
  const fillPct = Math.min(Math.max(pct * 100, 0), 100)
  const color = tone === 'onBlue' ? 'white' : TRACK_COLORS[paceStatus]

  return (
    <div className={tone === 'onBlue' ? 'relative h-2 w-full overflow-hidden rounded-full bg-white/20' : 'relative h-2 w-full overflow-hidden rounded-full bg-bg-tertiary'}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${fillPct}%`, background: color }}
      />
    </div>
  )
}
