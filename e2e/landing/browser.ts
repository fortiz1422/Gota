import { expect, type Locator, type Page } from '@playwright/test'

export const shot = {
  animations: 'disabled' as const,
  scale: 'device' as const,
  threshold: 0.2,
  maxDiffPixelRatio: 0.002,
}

export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => {
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(600)
}

/** The page under screenshot. Baselines are captured from the mockup. */
export function subjectPath() {
  return process.env.LANDING_UNDER_TEST === 'mockup' ? '/__mockup' : '/'
}

export async function openSubject(page: Page) {
  await page.goto(subjectPath(), { waitUntil: 'networkidle' })
  await settle(page)
}

/**
 * Element screenshots are clipped to an integer document pixel. A fractional
 * top (the draft hero is taller only at 320) rasterizes the same glyphs one
 * CSS pixel lower. Nudging the element onto the pixel grid keeps the section
 * comparison independent of content above it.
 */
export async function alignForShot(locator: Locator) {
  await locator.evaluate((el) => {
    if (!(el instanceof HTMLElement)) return
    const rect = el.getBoundingClientRect()
    const fracY =
      rect.top + window.scrollY - Math.floor(rect.top + window.scrollY)
    const fracX =
      rect.left + window.scrollX - Math.floor(rect.left + window.scrollX)
    if (fracY <= 0.001 && fracX <= 0.001) return
    if (getComputedStyle(el).position === 'static')
      el.style.position = 'relative'
    const style = getComputedStyle(el)
    if (fracY > 0.001) {
      const current = style.top === 'auto' ? 0 : Number.parseFloat(style.top)
      el.style.top = `${current + (1 - fracY)}px`
    }
    if (fracX > 0.001) {
      const current = style.left === 'auto' ? 0 : Number.parseFloat(style.left)
      el.style.left = `${current + (1 - fracX)}px`
    }
  })
}

export async function expectShot(
  locator: Locator,
  name: string,
  options: typeof shot & { mask?: Locator[]; fullPage?: boolean }
) {
  await alignForShot(locator)
  await expect(locator).toHaveScreenshot(name, options)
}
