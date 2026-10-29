/** Data API limits apply even without .limit(). A financial total requires every page. */
const PAGE_SIZE = 500

type Page<T> = { data: T[] | null; error: unknown; count: number | null }
export async function readCompleteLedger<T>(
  readPage: (from: number, to: number) => PromiseLike<Page<T>>,
  identify: (row: T) => string = (row) => (row as { id: string }).id
): Promise<{ data: T[]; error: null }> {
  const rows: T[] = []
  const ids = new Set<string>()
  let expectedCount: number | undefined
  for (;;) {
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
      result.data.length > Math.min(PAGE_SIZE, expectedCount - from) ||
      (result.data.length === 0 && from < expectedCount)
    )
      throw new Error('balance_unavailable')
    for (const row of result.data) {
      const id = identify(row)
      if (typeof id !== 'string' || !id || ids.has(id))
        throw new Error('balance_unavailable')
      ids.add(id)
      rows.push(row)
    }
    if (rows.length === expectedCount) return { data: rows, error: null }
  }
}
