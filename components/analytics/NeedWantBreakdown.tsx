import { CATEGORY_ICONS } from '@/lib/categories'

type Row = {
  category: string
  wantAmount: number
  needAmount: number
  wantCount: number
  needCount: number
  wantPct: number
}

interface Props {
  data: Row[]
}

export function NeedWantBreakdown({ data }: Props) {
  if (!data.length) return null

  return (
    <div style={{ padding: '0 8px' }}>
      <p
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#7B98B8',
          marginBottom: 20,
        }}
      >
        Necesidades vs. Deseos
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {data.map(({ category, wantCount, needCount, wantPct }) => {
          const labelColor =
            wantPct >= 60 ? '#fdba74' : wantPct <= 30 ? '#4ade80' : '#7B98B8'
          return (
            <div key={category}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: 7,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: '#f0f9ff' }}>
                  {CATEGORY_ICONS[category] ?? '•'} {category}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: labelColor,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {wantPct}% deseo
                </span>
              </div>
              <div
                style={{
                  height: 5,
                  borderRadius: 9999,
                  overflow: 'hidden',
                  background: 'rgba(148,210,255,0.06)',
                  display: 'flex',
                }}
              >
                <div style={{ width: `${100 - wantPct}%`, background: '#4ade80' }} />
                <div style={{ width: `${wantPct}%`, background: '#fdba74' }} />
              </div>
              <p style={{ marginTop: 5, fontSize: 10, color: '#4B6472' }}>
                {needCount} necesidad{needCount !== 1 ? 'es' : ''} · {wantCount} deseo{wantCount !== 1 ? 's' : ''}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
