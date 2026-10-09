import {
  balanceCheckDue,
  remaining,
  observedResidual,
  type Workspace,
} from './domain'
export function hasPendingExplanation(state: Workspace): boolean {
  const checkpoint = state.checkpoints.at(-1)
  const unadjusted =
    checkpoint &&
    !state.adjustments.some(
      (a) => a.checkpointId === checkpoint.id && !a.reversedAt
    ) &&
    observedResidual(state, checkpoint) !== 0
  return Boolean(
    unadjusted ||
    state.adjustments.some(
      (a) => !a.reversedAt && !a.manuallyClosed && remaining(state, a) !== 0
    ) ||
    state.draft
  )
}
export type BalanceCheckTask = {
  accountId: string
  accountName: string
  currency: 'ARS' | 'USD'
  href: string
  label: string
}
export function balanceCheckTask(
  account: { id: string; name: string },
  currency: 'ARS' | 'USD',
  state: Workspace | null,
  now: Date
): BalanceCheckTask | null {
  if (state?.snoozedUntil && Date.parse(state.snoozedUntil) > now.getTime())
    return null
  const pending = state ? hasPendingExplanation(state) : false
  if (
    !pending &&
    !balanceCheckDue(
      now,
      state?.checkpoints.at(-1)?.observedAt ?? null,
      state?.snoozedUntil ?? null
    )
  )
    return null
  return {
    accountId: account.id,
    accountName: account.name,
    currency,
    href: `/reconciliation/${encodeURIComponent(account.id)}?currency=${currency}`,
    label: pending
      ? `Seguir con ${account.name}`
      : `Confirmá tu saldo de ${account.name}`,
  }
}
