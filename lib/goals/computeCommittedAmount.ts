import type { GoalContributionRow } from '@/lib/goals/types'
import type { Currency } from '@/types/database'

export function computeCommittedAmount(
  contributions: Pick<GoalContributionRow, 'amount' | 'currency' | 'availability_effect'>[],
  currency: Currency,
): number {
  return contributions
    .filter(
      (contribution) =>
        contribution.currency === currency && contribution.availability_effect === 'committed_only',
    )
    .reduce((sum, contribution) => sum + contribution.amount, 0)
}
