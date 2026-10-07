export interface TourRect {
  top: number
  left: number
  width: number
  height: number
}

/** Keep the callout inside the visible viewport, preferring the side with room. */
export function placeTourMessage(
  target: TourRect,
  viewport: { width: number; height: number },
  messageHeight: number,
  preferred: 'top' | 'bottom'
) {
  const margin = 12
  const width = Math.max(0, Math.min(320, viewport.width - margin * 2))
  const below = target.top + target.height + 14
  const above = target.top - messageHeight - 14
  const fitsBelow = below + messageHeight <= viewport.height - margin
  const fitsAbove = above >= margin
  const candidate =
    preferred === 'bottom'
      ? fitsBelow
        ? below
        : fitsAbove
          ? above
          : below
      : fitsAbove
        ? above
        : fitsBelow
          ? below
          : above
  return {
    width,
    left: Math.max(
      margin,
      Math.min(
        target.left + target.width / 2 - width / 2,
        viewport.width - width - margin
      )
    ),
    top: Math.max(
      margin,
      Math.min(candidate, viewport.height - messageHeight - margin)
    ),
  }
}
