'use client'

import { useRef, useEffect, useCallback } from 'react'
import type { AnalyticsEvolutionData, AnalyticsComparisonContext } from '@/lib/analytics/analytics-overview'
import { formatCompact } from '@/lib/format'

interface Props {
  evolution: AnalyticsEvolutionData
  currency: 'ARS' | 'USD'
  comparisonContext: AnalyticsComparisonContext
}

// ─── Canvas chart (4+ months) ───────────────────────────────────────────────

interface CanvasProps {
  series: AnalyticsEvolutionData['series']
  averageValue: number | null
  currency: 'ARS' | 'USD'
  currentIdx: number
}

function EvolutionCanvas({ series, averageValue, currency, currentIdx }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeIdxRef = useRef(currentIdx)
  const pointXsRef = useRef<number[]>([])

  const draw = useCallback(
    (activeIdx: number) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.offsetWidth
      const cssH = 72
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr

      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, cssW, cssH)

      if (series.length === 0) return

      // Layout margins
      const PAD_TOP = 22   // space for label above active point
      const PAD_BOT = 18   // space for month labels
      const PAD_LEFT = 30  // space for "prom." label
      const PAD_RIGHT = 6
      const chartW = Math.max(cssW - PAD_LEFT - PAD_RIGHT, 1)
      const chartH = cssH - PAD_TOP - PAD_BOT

      const n = series.length
      const maxVal = Math.max(...series.map((p) => p.value), averageValue ?? 0, 1)

      // Point positions (CSS pixels)
      const xs = series.map((_, i) =>
        PAD_LEFT + (n > 1 ? (i / (n - 1)) * chartW : chartW / 2),
      )
      const ys = series.map((p) => PAD_TOP + chartH - (p.value / maxVal) * chartH)
      pointXsRef.current = xs

      // ── Average band + dashed line ──
      if (averageValue && averageValue > 0) {
        const avgY = PAD_TOP + chartH - (averageValue / maxVal) * chartH

        // Band
        const bandH = chartH * 0.22
        ctx.fillStyle = 'rgba(33,120,168,0.09)'
        ctx.beginPath()
        ctx.roundRect(PAD_LEFT, avgY - bandH / 2, chartW, bandH, 4)
        ctx.fill()

        // Dashed line
        ctx.save()
        ctx.strokeStyle = 'rgba(33,120,168,0.35)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 4])
        ctx.beginPath()
        ctx.moveTo(PAD_LEFT, avgY)
        ctx.lineTo(cssW - PAD_RIGHT, avgY)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()

        // "prom." label — white bg so it reads over the band
        const labelText = 'prom.'
        ctx.font = '500 8px "DM Sans", sans-serif'
        const textW = ctx.measureText(labelText).width
        const boxW = textW + 6
        const boxH = 12
        const boxX = 1
        const boxY = avgY - boxH / 2

        ctx.fillStyle = '#F8FAFB'
        ctx.fillRect(boxX, boxY, boxW, boxH)
        ctx.fillStyle = 'rgba(33,120,168,0.70)'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        ctx.fillText(labelText, boxX + 3, avgY)
      }

      // ── Connector line ──
      if (n > 1) {
        ctx.strokeStyle = '#2178A8'
        ctx.lineWidth = 1.5
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        xs.forEach((x, i) => {
          if (i === 0) ctx.moveTo(x, ys[i])
          else ctx.lineTo(x, ys[i])
        })
        ctx.stroke()
      }

      // ── Points ──
      series.forEach((_, i) => {
        const x = xs[i]
        const y = ys[i]
        const isActive = i === activeIdx

        if (isActive) {
          // Halo
          ctx.fillStyle = 'rgba(13,24,41,0.10)'
          ctx.beginPath()
          ctx.arc(x, y, 10, 0, Math.PI * 2)
          ctx.fill()
          // Circle
          ctx.fillStyle = '#0D1829'
          ctx.beginPath()
          ctx.arc(x, y, 5.5, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillStyle = '#B8D0E4'
          ctx.beginPath()
          ctx.arc(x, y, 3.5, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // ── Label above active point ──
      const activePt = series[activeIdx]
      if (activePt) {
        const x = xs[activeIdx]
        const y = ys[activeIdx]
        const avgVal = averageValue ?? 0
        const deltaVal =
          avgVal > 0
            ? Math.round(((activePt.value - avgVal) / avgVal) * 100)
            : null
        const labelStr =
          deltaVal !== null
            ? deltaVal > 0
              ? `+${deltaVal}% vs prom.`
              : `${deltaVal}% vs prom.`
            : formatCompact(activePt.value, currency)

        ctx.font = '600 9px "DM Sans", sans-serif'
        const textW = ctx.measureText(labelStr).width
        const boxW = textW + 10
        const boxH = 14
        const boxX = Math.min(Math.max(x - boxW / 2, PAD_LEFT), cssW - PAD_RIGHT - boxW)
        const boxY = y - 12 - boxH

        ctx.fillStyle = '#F0F4F8'
        ctx.strokeStyle = '#DDE5EC'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.roundRect(boxX, boxY, boxW, boxH, 3)
        ctx.fill()
        ctx.stroke()

        ctx.fillStyle = '#0D1829'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'center'
        ctx.fillText(labelStr, boxX + boxW / 2, boxY + boxH / 2)
      }

      // ── Month labels ──
      series.forEach((point, i) => {
        const isActive = i === activeIdx
        ctx.font = isActive
          ? '600 9px "DM Sans", sans-serif'
          : '400 9px "DM Sans", sans-serif'
        ctx.fillStyle = isActive ? '#0D1829' : '#90A4B0'
        ctx.textBaseline = 'top'
        ctx.textAlign = 'center'
        ctx.fillText(point.label, xs[i], cssH - PAD_BOT + 4)
      })
    },
    [series, averageValue, currency],
  )

  const getIdxFromX = useCallback((clientX: number): number => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const xs = pointXsRef.current
    let minDist = Infinity
    let idx = 0
    xs.forEach((px, i) => {
      const d = Math.abs(x - px)
      if (d < minDist) {
        minDist = d
        idx = i
      }
    })
    return idx
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    draw(activeIdxRef.current)

    const ro = new ResizeObserver(() => draw(activeIdxRef.current))
    ro.observe(canvas.parentElement!)

    const handleMouseMove = (e: MouseEvent) => {
      const idx = getIdxFromX(e.clientX)
      if (idx !== activeIdxRef.current) {
        activeIdxRef.current = idx
        draw(idx)
      }
    }
    const handleMouseLeave = () => {
      activeIdxRef.current = currentIdx
      draw(currentIdx)
    }
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      const idx = getIdxFromX(e.touches[0].clientX)
      activeIdxRef.current = idx
      draw(idx)
    }
    const handleTouchEnd = () => {
      activeIdxRef.current = currentIdx
      draw(currentIdx)
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true })
    canvas.addEventListener('touchend', handleTouchEnd)

    return () => {
      ro.disconnect()
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      canvas.removeEventListener('touchstart', handleTouchStart)
      canvas.removeEventListener('touchend', handleTouchEnd)
    }
  }, [draw, getIdxFromX, currentIdx])

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '72px', cursor: 'default' }}
    />
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export function AnalyticsEvolution({ evolution, comparisonContext, currency }: Props) {
  const { series } = evolution
  const monthsWithData = series.filter((p) => p.value > 0).length

  // ── Estado 1: solo 1 mes ──
  if (monthsWithData <= 1) {
    return (
      <section className="mt-4">
        <div style={{ borderTop: '0.5px solid #DDE5EC' }} />
        <p
          style={{
            fontSize: 12,
            color: '#90A4B0',
            textAlign: 'center',
            padding: '12px 22px',
          }}
        >
          El gráfico de evolución aparece a partir del segundo mes
        </p>
        <div style={{ borderBottom: '0.5px solid #DDE5EC' }} />
      </section>
    )
  }

  // ── Estado 2: 2-3 meses → comparación ──
  if (monthsWithData <= 3) {
    const currIdx = series.findIndex((p) => p.isCurrent)
    const currPoint = series[currIdx >= 0 ? currIdx : series.length - 1]
    const prevPoint = series[(currIdx >= 0 ? currIdx : series.length - 1) - 1] ?? null

    const delta =
      prevPoint && prevPoint.value > 0
        ? Math.round(((currPoint.value - prevPoint.value) / prevPoint.value) * 100)
        : null
    const isUp = (delta ?? 0) > 0

    const currSubtitle =
      comparisonContext.isCurrentMonth && comparisonContext.comparisonDay
        ? `al día ${comparisonContext.comparisonDay}`
        : 'mes completo'

    return (
      <section style={{ margin: '20px 22px 0' }}>
        <div
          style={{
            background: 'rgba(255,255,255,0.55)',
            borderRadius: 14,
            border: '0.5px solid rgba(255,255,255,0.85)',
            padding: '14px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Mes anterior */}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: '#90A4B0' }}>{prevPoint?.label ?? ''}</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#4A6070', marginTop: 2 }}>
                {formatCompact(prevPoint?.value ?? 0, currency)}
              </p>
              <p style={{ fontSize: 10, color: '#B0BEC5', marginTop: 2 }}>mes completo</p>
            </div>

            {/* Delta central */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: '0 16px',
              }}
            >
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: isUp ? '#B84A12' : '#1A7A42',
                }}
              >
                {delta !== null ? (isUp ? `+${delta}%` : `${delta}%`) : '—'}
              </p>
              <div style={{ width: 24, height: 1, background: '#DDE5EC' }} />
            </div>

            {/* Mes actual */}
            <div style={{ flex: 1, textAlign: 'right' }}>
              <p style={{ fontSize: 11, color: '#90A4B0' }}>{currPoint?.label ?? ''}</p>
              <p style={{ fontSize: 16, fontWeight: 600, color: '#0D1829', marginTop: 2 }}>
                {formatCompact(currPoint?.value ?? 0, currency)}
              </p>
              <p style={{ fontSize: 10, color: '#B0BEC5', marginTop: 2 }}>{currSubtitle}</p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // ── Estado 3: 4+ meses → canvas chart ──
  const currentIdx = series.findIndex((p) => p.isCurrent)

  return (
    <section className="px-[22px] pt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 className="type-title text-text-primary">{evolution.title}</h3>
          {evolution.subcopy ? (
            <p className="mt-1 text-[13px] text-text-secondary">{evolution.subcopy}</p>
          ) : null}
        </div>
        {evolution.averageValue ? (
          <div className="text-right">
            <p className="type-micro text-text-tertiary">{evolution.averageLabel}</p>
            <p className="text-[12px] font-semibold text-text-secondary">
              {formatCompact(evolution.averageValue, currency)}
            </p>
          </div>
        ) : null}
      </div>

      <div
        style={{
          background: 'rgba(255,255,255,0.45)',
          borderRadius: 14,
          border: '0.5px solid rgba(255,255,255,0.85)',
          padding: '14px 16px 10px',
        }}
      >
        <EvolutionCanvas
          series={series}
          averageValue={evolution.averageValue}
          currency={currency}
          currentIdx={currentIdx >= 0 ? currentIdx : series.length - 1}
        />
      </div>
    </section>
  )
}
