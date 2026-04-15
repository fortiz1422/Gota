'use client'

import { FugaSilenciosaCard, DrillFugaSilenciosa } from './FugaSilenciosa'
import { MapaHabitosCard, DrillMapaHabitos } from './MapaHabitos'
import { CompromisosCard, DrillCompromisos } from './Compromisos'
import type { Metrics, HabitosDayEntry } from '@/lib/analytics/computeMetrics'
import type { CompromisosData } from '@/lib/analytics/computeCompromisos'

type DrillTarget = 'fuga' | 'habitos' | 'compromisos'

interface Props {
  metrics: Metrics
  compromisos: CompromisosData
  drill: DrillTarget | null
  setDrill: (d: DrillTarget | null) => void
  selDay: HabitosDayEntry | null
  setSelDay: (d: HabitosDayEntry | null) => void
  selectedMonth: string
}

export function AnalysisView({
  metrics,
  compromisos,
  drill,
  setDrill,
  selDay,
  setSelDay,
  selectedMonth,
}: Props) {
  const { currency, fugaSilenciosa, habitosMap } = metrics

  if (drill === 'fuga') {
    return <DrillFugaSilenciosa data={fugaSilenciosa} currency={currency} />
  }

  if (drill === 'habitos') {
    return (
      <DrillMapaHabitos
        habitosMap={habitosMap}
        selDay={selDay}
        setSelDay={setSelDay}
        currency={currency}
        selectedMonth={selectedMonth}
      />
    )
  }

  if (drill === 'compromisos') {
    return (
      <DrillCompromisos
        data={compromisos}
        currency={currency}
        selectedMonth={selectedMonth}
      />
    )
  }

  // Overview: 3 bento cards
  return (
    <div className="px-5 space-y-3">
      <FugaSilenciosaCard
        data={fugaSilenciosa}
        currency={currency}
        onClick={() => setDrill('fuga')}
      />
      <MapaHabitosCard
        habitosMap={habitosMap}
        currency={currency}
        onClick={() => setDrill('habitos')}
      />
      <CompromisosCard
        data={compromisos}
        currency={currency}
        selectedMonth={selectedMonth}
        onClick={() => setDrill('compromisos')}
      />
    </div>
  )
}
