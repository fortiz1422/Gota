import { expect, test } from '@playwright/test'
import copy from '../../app/landing/landing-copy.json'
import { settle } from './browser'

async function readPage(page: import('@playwright/test').Page) {
  await page.evaluate(() => document.fonts.ready)
  return page.evaluate(() => {
    const hero = document.querySelector('.hero-copy')
    const held = document.createElement('div')
    hero?.replaceWith(held)
    const withoutHero = document.body.innerText
    held.replaceWith(hero as Node)
    const names = [
      'alt',
      'aria-label',
      'aria-describedby',
      'id',
      'placeholder',
      'value',
      'maxlength',
      'inputmode',
      'pattern',
    ]
    const attrs = [...document.querySelectorAll('*')].flatMap((el) =>
      names.flatMap((name) => {
        const value = el.getAttribute(name)
        return value == null ? [] : [`${name}=${value}`]
      })
    )
    return {
      withoutHero,
      heroTitle: document.querySelector('#hero-title')?.textContent ?? '',
      heroSub: document.querySelector('.hero-sub')?.textContent ?? '',
      heroSign: document.querySelector('.hero-sign2')?.textContent ?? '',
      hrefs: [...document.querySelectorAll('a')].map((anchor) =>
        anchor.getAttribute('href')
      ),
      attrs,
      style: document.querySelector('style')?.textContent ?? '',
      title: document.title,
    }
  })
}

test('body copy matches the mockup except the draft hero', async ({ page }) => {
  await page.goto('/__mockup', { waitUntil: 'networkidle' })
  await settle(page)
  const mockup = await readPage(page)
  await page.goto('/', { waitUntil: 'networkidle' })
  await settle(page)
  const prod = await readPage(page)

  expect(prod.withoutHero).toBe(mockup.withoutHero)
  expect(prod.attrs).toEqual(mockup.attrs)
  expect(prod.hrefs).toEqual(mockup.hrefs)
  expect(prod.hrefs.filter((href) => href === '/start')).toHaveLength(3)
  expect(prod.style).toBe(mockup.style)
  expect(prod.title).toBe(copy.META_TITLE)
  expect(prod.heroTitle).toBe(`${copy.HERO_TITLE_PRE} ${copy.HERO_TITLE_EM}`)
  expect(prod.heroSub).toBe(copy.HERO_SUB)
  expect(prod.heroSign).toBe(`${copy.HERO_SIGN_PRE} ${copy.HERO_SIGN_EM}`)
  expect(prod.title.toLowerCase()).not.toMatch(/mockup|borrador/)
})
