import { describe, expect, it, vi } from 'vitest'
import { deleteGoalContribution } from '@/components/analytics/GoalContributionHistory'

describe('deleteGoalContribution', () => {
  it('sends the exact manual-contribution DELETE request', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true })

    await deleteGoalContribution('goal-1', 'contribution-2', request)

    expect(request).toHaveBeenCalledOnce()
    expect(request).toHaveBeenCalledWith(
      '/api/goals/goal-1/contributions/contribution-2',
      { method: 'DELETE' },
    )
  })

  it('rejects an unsuccessful DELETE so the confirmation remains open with its error', async () => {
    const request = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({ error: 'El aporte ya no existe.' }),
    })

    await expect(deleteGoalContribution('goal-1', 'contribution-2', request)).rejects.toThrow(
      'El aporte ya no existe.',
    )
  })
})