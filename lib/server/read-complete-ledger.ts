/** Data API limits apply even without .limit(). A financial total requires every page. */
const PAGE_SIZE = 500
const MAX_PAGES = 200

type Page<T> = { data: T[] | null; error: unknown; count: number | null }
export async function readCompleteLedger<T extends { id: string }>(
  readPage: (from: number, to: number) => PromiseLike<Page<T>>
): Promise<{ data: T[]; error: null }> {
  const rows: T[] = []
  const ids = new Set<string>()
  let expectedCount: number | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = rows.length
    const result = await readPage(from, from + PAGE_SIZE - 1)
    if (
      result.error ||
      !Array.isArray(result.data) ||
      result.count === null ||
      !Number.isSafeInteger(result.count) ||
      result.count < 0
    )
      throw new Error('balance_unavailable')
    expectedCount ??= result.count
    if (
      result.count !== expectedCount ||
      result.data.length !== Math.min(PAGE_SIZE, expectedCount - from)
    )
      throw new Error('balance_unavailable')
    for (const row of result.data) {
      if (typeof row.id !== 'string' || !row.id || ids.has(row.id))
        throw new Error('balance_unavailable')
      ids.add(row.id)
      rows.push(row)
    }
    if (rows.length === expectedCount) return { data: rows, error: null }
  }
  throw new Error('balance_unavailable')
}
