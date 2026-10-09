/** Expense/income timestamps use the full Argentina calendar day, like date-only ledger rows. */
export function liveLedgerExclusiveEnd(today: string): string {
  return new Date(
    Date.parse(`${today}T00:00:00-03:00`) + 86400000
  ).toISOString()
}
