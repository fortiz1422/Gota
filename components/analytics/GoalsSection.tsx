'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Target } from '@phosphor-icons/react'
import { EmptyState } from '@/components/ui/EmptyState'
import { GoalContributionSheet } from './GoalContributionSheet'
import { GoalCreateSheet } from './GoalCreateSheet'
import { GoalDetailSheet } from './GoalDetailSheet'
import { GoalEmptyState } from './GoalEmptyState'
import { GoalRow } from './GoalRow'
import { GoalsFocusList } from './GoalsFocusList'
import type { GoalWithMetrics } from '@/lib/goals/types'
import { getCurrentMonth } from '@/lib/dates'

interface Props {
  selectedMonth: string
}

function GoalsSkeleton() {
  return (
    <div className="mx-auto max-w-md px-[22px]">
      <div className="card-s5 space-y-3 px-4 py-4">
        <div className="h-6 w-32 rounded skeleton" />
        <div className="h-20 rounded-card skeleton" />
        <div className="h-20 rounded-card skeleton" />
      </div>
    </div>
  )
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mx-4 my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-separator" />
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">{label}</span>
      <div className="h-px flex-1 bg-separator" />
    </div>
  )
}

function buildSectionCopy(goals: GoalWithMetrics[]) {
  if (goals.some((goal) => goal.paceStatus === 'behind')) {
    return 'Empezá por las metas que perdieron ritmo y dejá el resto ordenado abajo.'
  }

  if (goals.some((goal) => goal.committedAmount > 0)) {
    return 'Hay aportes ya comprometidos. Esto te deja ver progreso y caja sin mezclar conceptos.'
  }

  return 'Metas te da dirección sin tocar la semántica de tu caja real.'
}

export function GoalsSection({ selectedMonth }: Props) {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<GoalWithMetrics | null>(null)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading, isError, refetch } = useQuery<{ goals: GoalWithMetrics[] }>({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await fetch('/api/goals')
      if (!res.ok) throw new Error('goals fetch failed')
      return res.json()
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['goals'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  async function handleStatusChange(
    goalId: string,
    status: 'active' | 'paused' | 'completed' | 'archived',
  ) {
    const res = await fetch(`/api/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      throw new Error(data?.error ?? 'No se pudo actualizar la meta.')
    }
    await refresh()
  }

  function openContribute(goal: GoalWithMetrics) {
    setSelectedGoal(goal)
    setContributeOpen(true)
  }

  function openDetail(goal: GoalWithMetrics) {
    setSelectedGoal(goal)
    setDetailOpen(true)
  }

  const goals = useMemo(() => data?.goals ?? [], [data?.goals])
  const activeGoals = useMemo(() => goals.filter((goal) => goal.status === 'active'), [goals])
  const pausedGoals = useMemo(() => goals.filter((goal) => goal.status === 'paused'), [goals])
  const completedGoals = useMemo(() => goals.filter((goal) => goal.status === 'completed'), [goals])
  const historicalNotice = selectedMonth !== getCurrentMonth() ? (
    <p className="mb-3 rounded-card border border-primary/10 bg-primary/5 px-3 py-2 text-[12px] leading-5 text-text-secondary">
      Las metas muestran su estado actual, no una foto histórica del mes seleccionado.
    </p>
  ) : null

  if (isLoading) return <GoalsSkeleton />

  if (isError) {
    return (
      <div className="mx-auto max-w-md px-[22px] pb-4">
        <EmptyState
          icon={Target}
          title="No pudimos cargar tus metas"
          subtitle="Revisá tu conexión e intentá nuevamente. Tus metas no cambiaron."
          ctaLabel="Reintentar"
          onCta={() => { void refetch() }}
        />
      </div>
    )
  }

  if (goals.length === 0) {
    return (
      <div className="mx-auto max-w-md px-[22px] pb-4">
        {historicalNotice}
        <GoalEmptyState onCreate={() => setCreateOpen(true)} />
        <GoalCreateSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-[22px] pb-4">
      {historicalNotice}
      <section className="card-s5 overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 pt-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">Metas</p>
            <p className="mt-1 text-[13px] leading-5 text-text-secondary">{buildSectionCopy(goals)}</p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="shrink-0 rounded-pill border border-primary/20 bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary transition-opacity hover:opacity-80 active:opacity-60"
          >
            Nueva meta
          </button>
        </div>

        <div className="mt-4 border-t border-separator" />

        <GoalsFocusList goals={goals} onOpenGoal={openDetail} />

        <div className="border-t border-separator px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
              Metas activas
            </p>
            <span className="text-[12px] text-text-tertiary">
              {activeGoals.length} activa{activeGoals.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-3">
            {activeGoals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onContribute={() => openContribute(goal)}
                onDetail={() => openDetail(goal)}
              />
            ))}
          </div>
        </div>

        {pausedGoals.length > 0 ? (
          <>
            <SectionDivider label="Pausadas" />
            <div className="px-4 pb-4 space-y-3">
              {pausedGoals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onContribute={() => openContribute(goal)}
                  onDetail={() => openDetail(goal)}
                />
              ))}
            </div>
          </>
        ) : null}

        {completedGoals.length > 0 ? (
          <>
            <SectionDivider label="Completadas" />
            <div className="px-4 pb-4 space-y-3">
              {completedGoals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onContribute={() => openContribute(goal)}
                  onDetail={() => openDetail(goal)}
                />
              ))}
            </div>
          </>
        ) : null}
      </section>

      <GoalCreateSheet open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />

      <GoalContributionSheet
        open={contributeOpen}
        goal={selectedGoal}
        onClose={() => setContributeOpen(false)}
        onContributed={refresh}
      />

      <GoalDetailSheet
        open={detailOpen}
        goal={selectedGoal}
        onClose={() => setDetailOpen(false)}
        onContribute={() => {
          setDetailOpen(false)
          setContributeOpen(true)
        }}
        onStatusChange={handleStatusChange}
      />
    </div>
  )
}
