import type { DashboardData } from '@/types/database'

interface Props {
  data: DashboardData['filtro_estoico']
}

export function FiltroEstoico({ data }: Props) {
  if (!data || data.total_count === 0) return null

  const totalAmount = data.necesidad_amount + data.deseo_amount
  const necesidadPct = totalAmount > 0
    ? Math.round((data.necesidad_amount / totalAmount) * 100)
    : Math.round((data.necesidad_count / data.total_count) * 100)
  const deseoPct = 100 - necesidadPct

  return (
    <div className="px-2">
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#7B98B8',
          }}
        >
          Necesidad · {necesidadPct}%
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#7B98B8',
          }}
        >
          Deseo · {deseoPct}%
        </span>
      </div>

      {/* Battery bar */}
      <div
        style={{
          height: 6,
          borderRadius: 9999,
          overflow: 'hidden',
          background: 'rgba(148,210,255,0.06)',
          display: 'flex',
        }}
      >
        <div
          style={{
            width: `${necesidadPct}%`,
            background: '#4ade80',
            borderRadius: '9999px 0 0 9999px',
          }}
        />
        <div style={{ width: 1.5, background: '#050A14', flexShrink: 0 }} />
        <div
          style={{
            flex: 1,
            background: '#fdba74',
            borderRadius: '0 9999px 9999px 0',
          }}
        />
      </div>

      {/* Sublabels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: '#4B6472' }}>
          {data.necesidad_count} {data.necesidad_count === 1 ? 'gasto' : 'gastos'}
        </span>
        <span style={{ fontSize: 10, color: '#4B6472' }}>
          {data.deseo_count} {data.deseo_count === 1 ? 'gasto' : 'gastos'}
        </span>
      </div>
    </div>
  )
}
