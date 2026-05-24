'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GoalEmptyState } from './GoalEmptyState'
import { GoalRow } from './GoalRow'
import { GoalCreateSheet } from './GoalCreateSheet'
import { GoalContributionSheet } from './GoalContributionSheet'
import { GoalDetailSheet } from './GoalDetailSheet'
import type { GoalWithMetrics } from '@/lib/goals/types'

interface Props {
  selectedMonth: string
}

function GoalsSkeleton() {
  return (
    <div className="px-5 space-y-3">
      <div className="h-32 rounded-card skeleton" />
      <div className="h-32 rounded-card skeleton" />
    </div>
  )
}

export function GoalsSection({ selectedMonth }: Props) {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedGoal, setSelectedGoal] = useState<GoalWithMetrics | null>(null)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)

  const { data, isLoading } = useQuery<{ goals: GoalWithMetrics[] }>({
    queryKey: ['goals', selectedMonth],
    queryFn: async () => {
      const res = await fetch('/api/goals')
      if (!res.ok) throw new Error('goals fetch failed')
      return res.json()
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['goals'] })
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

  if (isLoading) return <GoalsSkeleton />

  const goals = data?.goals ?? []
  const active = goals.filter((g) => g.status === 'active' || g.status === 'paused')
  const completed = goals.filter((g) => g.status === 'completed')

  return (
    <div className="pb-4">
      <div className="mx-5 mb-3 flex items-center justify-between">
        <p className="text-[12px] text-text-tertiary">
          {active.length > 0
            ? `${active.length} meta${active.length !== 1 ? 's' : ''} activa${active.length !== 1 ? 's' : ''}`
            : 'Sin metas activas'}
        </p>
        {goals.length > 0 && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="rounded-full border border-border-ocean px-3 py-1.5 text-[12px] font-semibold text-primary"
          >
            Nueva meta
          </button>
        )}
      </div>

      {goals.length === 0 ? (
        <GoalEmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <>
          {active.map((goal) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              onContribute={() => openContribute(goal)}
              onDetail={() => openDetail(goal)}
            />
          ))}

          {completed.length > 0 && (
            <>
              <div className="mx-5 my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-separator" />
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
                  Completadas
                </span>
                <div className="h-px flex-1 bg-separator" />
              </div>
              {completed.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onContribute={() => openContribute(goal)}
                  onDetail={() => openDetail(goal)}
                />
              ))}
            </>
          )}
        </>
      )}

      <GoalCreateSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refresh}
      />

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
