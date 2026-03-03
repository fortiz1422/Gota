import { formatCompact } from '@/lib/format'

type TrendMonth = {
  month: string   // YYYY-MM
  label: string   // «Oct»
  expenses: number
  income: number
  isSelected: boolean
}

interface Props {
  data: TrendMonth[]
  currency: 'ARS' | 'USD'
}

const W = 375
const H = 120
const PAD_Y = 16

export function MonthlyTrends({ data, currency }: Props) {
  const hasData = data.some((d) => d.expenses > 0 || d.income > 0)

  if (!hasData) {
    return (
      <div className="px-2 py-4">
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#7B98B8',
            marginBottom: 8,
          }}
        >
          Tendencias
        </p>
        <p style={{ fontSize: 13, color: '#4B6472' }}>
          Cargá gastos en varios meses para ver la evolución.
        </p>
      </div>
    )
  }

  const maxExp = Math.max(...data.map((d) => d.expenses), 1)
  const maxInc = Math.max(...data.map((d) => d.income), 1)

  const n = data.length
  const px = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W)
  const py = (v: number, max: number) => H - PAD_Y - (v / max) * (H - PAD_Y * 2)

  const wave = (values: number[], max: number, close: boolean): string => {
    const pts = values.map((v, i) => [px(i), py(v, max)] as [number, number])
    let d = `M${pts[0][0]},${pts[0][1]}`
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]
      const [x1, y1] = pts[i + 1]
      const dx = x1 - x0
      d += ` C${x0 + dx * 0.42},${y0 + (y1 - y0) * 0.06} ${x1 - dx * 0.56},${y1 - (y1 - y0) * 0.2} ${x1},${y1}`
    }
    if (close) {
      d += ` L${pts[pts.length - 1][0]},${H + 8} L${pts[0][0]},${H + 8} Z`
    }
    return d
  }

  const expValues = data.map((d) => d.expenses)
  const incValues = data.map((d) => d.income)

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 16px 12px',
        }}
      >
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { color: '#38bdf8', label: 'Gastos' },
            { color: '#4ade80', label: 'Ingresos' },
          ].map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: l.color,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 10, color: '#7B98B8' }}>{l.label}</span>
            </div>
          ))}
        </div>
        {/* Selected month summary */}
        {(() => {
          const sel = data.find((d) => d.isSelected)
          const prev = data[data.findIndex((d) => d.isSelected) - 1]
          if (!sel) return null
          return (
            <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
              {prev && prev.expenses > 0 && (
                <span style={{ color: '#4B6472' }}>
                  {prev.label}{' '}
                  <span style={{ color: '#f0f9ff', fontWeight: 600 }}>
                    {formatCompact(prev.expenses, currency)}
                  </span>
                </span>
              )}
              <span style={{ color: '#38bdf8' }}>
                {sel.label}{' '}
                <span style={{ color: '#f0f9ff', fontWeight: 600 }}>
                  {formatCompact(sel.expenses, currency)}
                </span>
              </span>
            </div>
          )
        })()}
      </div>

      {/* Edge-to-edge wave SVG */}
      <svg
        viewBox={`0 0 ${W} ${H + 28}`}
        width="100%"
        style={{ display: 'block' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="tg-inc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tg-exp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fills */}
        {incValues.some((v) => v > 0) && (
          <path d={wave(incValues, maxInc, true)} fill="url(#tg-inc)" />
        )}
        {expValues.some((v) => v > 0) && (
          <path d={wave(expValues, maxExp, true)} fill="url(#tg-exp)" />
        )}

        {/* Lines */}
        {incValues.some((v) => v > 0) && (
          <path
            d={wave(incValues, maxInc, false)}
            fill="none"
            stroke="#4ade80"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}
        {expValues.some((v) => v > 0) && (
          <path
            d={wave(expValues, maxExp, false)}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )}

        {/* Dots — expenses */}
        {data.map((d, i) =>
          d.expenses > 0 ? (
            <g key={`e-${i}`}>
              <circle cx={px(i)} cy={py(d.expenses, maxExp)} r="5" fill="#38bdf8" fillOpacity="0.12" />
              <circle
                cx={px(i)}
                cy={py(d.expenses, maxExp)}
                r={d.isSelected ? 3.5 : 2.5}
                fill="#38bdf8"
                stroke="#050A14"
                strokeWidth="1.5"
              />
            </g>
          ) : null
        )}

        {/* Dots — income */}
        {data.map((d, i) =>
          d.income > 0 ? (
            <g key={`inc-${i}`}>
              <circle cx={px(i)} cy={py(d.income, maxInc)} r="5" fill="#4ade80" fillOpacity="0.12" />
              <circle
                cx={px(i)}
                cy={py(d.income, maxInc)}
                r={d.isSelected ? 3.5 : 2.5}
                fill="#4ade80"
                stroke="#050A14"
                strokeWidth="1.5"
              />
            </g>
          ) : null
        )}

        {/* Month labels */}
        {data.map((d, i) => (
          <text
            key={`lbl-${i}`}
            x={px(i)}
            y={H + 20}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            fontSize="9"
            fontFamily="monospace"
            fill={d.isSelected ? '#38bdf8' : '#4B6472'}
            fontWeight={d.isSelected ? '700' : '400'}
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  )
}
