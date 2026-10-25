import type { CategoryPreview } from './category-preview'

/** One request per 20 distinct descriptions; no cross-user/module cache or paid retries. */
export async function loadCategoryPreviews(
  descriptions: string[],
  signal?: AbortSignal
): Promise<CategoryPreview[]> {
  const unique = [
    ...new Set(
      descriptions.map((d) => d.trim()).filter((d) => d && d.length <= 160)
    ),
  ].slice(0, 100)
  const chunks = Array.from({ length: Math.ceil(unique.length / 20) }, (_, n) =>
    unique.slice(n * 20, n * 20 + 20)
  )
  return (
    await Promise.all(
      chunks.map(async (descriptions) => {
        const response = await fetch('/api/expense-category-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descriptions }),
          signal,
        })
        if (!response.ok) throw new Error('category_preview_unavailable')
        const body = (await response.json()) as {
          suggestions?: CategoryPreview[]
        }
        if (!Array.isArray(body.suggestions))
          throw new Error('invalid_category_preview')
        return body.suggestions
      })
    )
  ).flat()
}
