import { expect, test } from '@playwright/test'
import { expectShot, openSubject, settle, shot } from './browser'

const sections = [
  'header.header',
  '#tarjeta',
  '#como-funciona',
  '.mid-cta',
  '#ademas',
  '#confianza',
  '#preguntas',
  '.final',
  'footer',
]

async function boxHeight(
  page: import('@playwright/test').Page,
  selector: string
) {
  return page
    .locator(selector)
    .evaluate((el) => Math.round(el.getBoundingClientRect().height))
}

test('section heights stay within 2px of the mockup outside the draft hero', async ({
  page,
}, testInfo) => {
  await page.goto('/__mockup', { waitUntil: 'networkidle' })
  await settle(page)
  const mockup = {
    page: await page.evaluate(() => document.documentElement.scrollHeight),
    hero: await boxHeight(page, 'section.hero'),
  }
  const mockSections = []
  for (const selector of sections)
    mockSections.push(await boxHeight(page, selector))

  await page.goto('/', { waitUntil: 'networkidle' })
  await settle(page)
  const prodPage = await page.evaluate(
    () => document.documentElement.scrollHeight
  )
  const prodHero = await boxHeight(page, 'section.hero')
  for (let index = 0; index < sections.length; index++) {
    const height = await boxHeight(page, sections[index])
    expect(
      Math.abs(height - mockSections[index]),
      sections[index]
    ).toBeLessThanOrEqual(2)
  }
  // Any page-height delta has to come from the hero. Draft copy is taller only at 320,
  // so full-page screenshots run at 390 and 1440, where the delta is at most 2px.
  expect(prodPage - mockup.page).toBe(prodHero - mockup.hero)
  if (testInfo.project.name !== '320') {
    expect(Math.abs(prodPage - mockup.page)).toBeLessThanOrEqual(2)
  }
})

test('matches the mockup section by section', async ({ page }, testInfo) => {
  await openSubject(page)
  for (const selector of sections) {
    const name = selector.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
    await expectShot(page.locator(selector), `${name}.png`, shot)
  }
  await expectShot(page.locator('.sim'), 'sim.png', shot)
  await expectShot(page.locator('.hero-actions'), 'hero-actions.png', shot)
  if (testInfo.project.name !== '320') {
    await expectShot(page.locator('section.hero'), 'hero.png', {
      ...shot,
      mask: [page.locator('.hero-copy')],
    })
    await expect(page).toHaveScreenshot('full-page.png', {
      ...shot,
      fullPage: true,
      mask: [page.locator('.hero-copy')],
    })
  }
})

test('negative simulator matches the mockup', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === '320')
  await openSubject(page)
  await page.locator('#sim-saldo').fill('100.000')
  await settle(page)
  await expectShot(page.locator('.sim'), 'sim-negative.png', shot)
})

const styleProps = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'letter-spacing',
  'border-radius',
  'box-shadow',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
]

test('computed styles and root tokens match the mockup', async ({ page }) => {
  async function signature() {
    return page.evaluate((props) => {
      const root = getComputedStyle(document.documentElement)
      const styleText = document.querySelector('style')?.textContent ?? ''
      const tokens = [...styleText.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(
        (match) => match[1]
      )
      const variables: Record<string, string> = {}
      for (const token of tokens)
        variables[token] = root.getPropertyValue(token).trim()
      const elements: string[] = []
      const walk = (el: Element) => {
        if (el.getClientRects().length > 0) {
          const computed = getComputedStyle(el)
          const values = props.map((prop) => computed.getPropertyValue(prop))
          elements.push(
            `${el.tagName}#${el.id}.${el.getAttribute('class')}|${values.join('|')}`
          )
        }
        for (const child of el.children) walk(child)
      }
      walk(document.body)
      return { variables, elements, font: document.fonts.check('16px Geist') }
    }, styleProps)
  }

  await page.goto('/__mockup', { waitUntil: 'networkidle' })
  await settle(page)
  const mockup = await signature()
  await page.goto('/', { waitUntil: 'networkidle' })
  await settle(page)
  const prod = await signature()
  expect(prod.font).toBe(true)
  expect(mockup.font).toBe(true)
  expect(prod.variables).toEqual(mockup.variables)
  expect(prod.elements).toEqual(mockup.elements)
})
