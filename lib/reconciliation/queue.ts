export type QueueAccount = { id: string; name: string }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function parseVisitedAccounts(raw?: string): string[] {
  return [
    ...new Set((raw ?? '').split(',').filter((id) => uuid.test(id))),
  ].slice(0, 50)
}
export function nextReconciliationAccount(
  accounts: QueueAccount[],
  currentId: string,
  visited: string[]
) {
  const excluded = new Set([...visited, currentId])
  return accounts.find((account) => !excluded.has(account.id)) ?? null
}
export function nextReconciliationHref(
  nextId: string,
  currentId: string,
  currency: 'ARS' | 'USD',
  visited: string[]
) {
  const passed = [...new Set([...visited, currentId])]
  return `/reconciliation/${encodeURIComponent(nextId)}?currency=${currency}&visited=${encodeURIComponent(passed.join(','))}`
}
