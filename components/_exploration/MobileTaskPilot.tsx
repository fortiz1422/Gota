'use client'

import { useId, useRef, useState } from 'react'
import { GoalCreateSheet } from '@/components/analytics/GoalCreateSheet'
import { GoalEditSheet } from '@/components/analytics/GoalEditSheet'
import { FullScreenSheet } from '@/components/ui/FullScreenSheet'
import type { GoalWithMetrics } from '@/lib/goals/types'

const goalFixture: GoalWithMetrics = {
  id: 'goal-pilot',
  name: 'Viaje a Japón',
  emoji: '✈️',
  colorToken: null,
  targetAmount: 6500000,
  currency: 'ARS',
  targetDate: '2027-04-15',
  startingAmount: 0,
  plannedMonthlyContribution: 320000,
  linkedAccountId: null,
  notes: 'Pasajes y estadía',
  status: 'active',
  createdAt: '2026-09-08T00:00:00.000Z',
  completedAt: null,
  pausedAt: null,
  currentAmount: 1450000,
  remainingAmount: 5050000,
  progressPct: 22.3,
  monthsRemaining: 7,
  requiredMonthlyContribution: 721429,
  paceStatus: 'behind',
  lastContributionAt: '2026-09-01',
  committedAmount: 1450000,
}

export function MobileTaskPilot() {
  const detailTitleId = useId()
  const editTriggerRef = useRef<HTMLButtonElement>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-tertiary p-6">
      <div className="max-w-sm text-center">
        <p className="type-micro text-primary">LABORATORIO VISUAL · SIN DATOS REALES</p>
        <h1 className="mt-3 type-title text-text-primary">Task Surface</h1>
        <p className="mt-3 type-body text-text-secondary">
          Renderiza el componente real de Nueva meta. El CTA no se usa durante la revisión visual.
        </p>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="mt-6 min-h-12 rounded-button bg-primary px-6 type-body-lg text-white"
        >
          Abrir Nueva meta
        </button>
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="mt-3 min-h-12 rounded-button border border-border-ocean px-6 type-body-lg text-primary"
        >
          Abrir detalle → Editar
        </button>
      </div>

      <GoalCreateSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => undefined} />

      <FullScreenSheet
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        labelledBy={detailTitleId}
      >
        <div data-goal-detail-pilot className="min-h-full bg-bg-primary p-[22px]">
          <p className="type-micro text-primary">DETALLE DE META · FIXTURE</p>
          <h2 id={detailTitleId} className="mt-2 type-title text-text-primary">✈️ Viaje a Japón</h2>
          <p className="mt-2 type-body text-text-secondary">$ 1.450.000 de $ 6.500.000</p>
          <button
            ref={editTriggerRef}
            type="button"
            onClick={() => setEditOpen(true)}
            className="mt-6 min-h-12 rounded-button bg-primary px-6 type-body-lg text-white"
          >
            Editar meta
          </button>
        </div>
      </FullScreenSheet>

      <GoalEditSheet
        open={editOpen}
        goal={goalFixture}
        onClose={() => setEditOpen(false)}
        onSaved={() => undefined}
        triggerRef={editTriggerRef}
      />
    </main>
  )
}