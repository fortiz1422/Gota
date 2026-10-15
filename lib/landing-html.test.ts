import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import copy from '@/app/landing/landing-copy.json'
import { GET } from '@/app/landing/route'
import {
  LANDING_COPY_KEYS,
  type LandingCopyKey,
  renderLandingHtml,
  resolveLandingCtaUrl,
} from '@/app/landing/render-landing'

const templatePath = join(process.cwd(), 'app/landing/landing-v57.html')
const template = readFileSync(templatePath, 'utf8')
const STYLE_SHA256 =
  '1efbeab4abd2103b4dc424d71fc8e57defc377607ead985ede975ab8948b78f4'
const SCRIPT_SHA256 =
  '14a6c6b212ec9222ee8303ad2f03de55fd49845981e901b52baab8185d191d49'

const draftCopy = Object.fromEntries(
  LANDING_COPY_KEYS.map((key) => [key, copy[key]])
) as Record<LandingCopyKey, string>

function hrefs(html: string) {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1])
}

describe('landing v5.7 template', () => {
  it('keeps the frozen stylesheet and simulator, with hero copy and CTAs as placeholders', () => {
    const style = template.match(/<style>[\s\S]*?<\/style>/)?.[0]
    const script = template.match(/<script>\n[\s\S]*?<\/script>/)?.[0]
    expect(
      createHash('sha256')
        .update(style ?? '')
        .digest('hex')
    ).toBe(STYLE_SHA256)
    expect(
      createHash('sha256')
        .update(script ?? '')
        .digest('hex')
    ).toBe(SCRIPT_SHA256)
    expect(template).toContain(
      '<h1 id="hero-title" class="h1-v5 h1-v56">{{HERO_TITLE_PRE}} <em>{{HERO_TITLE_EM}}</em></h1>'
    )
    expect(template).toContain('<p class="hero-sub">{{HERO_SUB}}</p>')
    expect(template).toContain(
      '<p class="hero-sign2">{{HERO_SIGN_PRE}} <span>{{HERO_SIGN_EM}}</span></p>'
    )
    expect(template.match(/href="\{\{CTA_URL\}\}"/g)).toHaveLength(3)
    expect(
      template.match(/src="\/brand\/gota-wordmark-primary\.svg"/g)
    ).toHaveLength(2)
    expect(template).not.toMatch(/mockup|borrador/i)
    expect(template).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/)
    expect(Buffer.byteLength(template)).toBeLessThanOrEqual(70 * 1024)
  })

  it('self-hosts the five Geist subsets, including the latin file used by the preload', () => {
    const css = readFileSync(
      join(process.cwd(), 'public/landing/v57/fonts/geist.css'),
      'utf8'
    )
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/)
    for (const weight of ['400', '500', '600', '650', '700']) {
      expect(css).toContain(`font-weight: ${weight}`)
    }
    const files = [
      'gyByhwUxId8gMEwcGFU.woff2',
      'gyByhwUxId8gMEwRGFWfOw.woff2',
      'gyByhwUxId8gMEwSGFWfOw.woff2',
      'gyByhwUxId8gMEwTGFWfOw.woff2',
      'gyByhwUxId8gMEwYGFWfOw.woff2',
    ]
    for (const file of files) {
      expect(css).toContain(`/landing/v57/fonts/${file}`)
      expect(
        readFileSync(join(process.cwd(), 'public/landing/v57/fonts', file))
          .byteLength
      ).toBeGreaterThan(1000)
    }
    expect(template).toContain(
      '<link rel="preload" href="/landing/v57/fonts/gyByhwUxId8gMEwcGFU.woff2" as="font" type="font/woff2" crossorigin>'
    )
  })
})

describe('landing copy and CTA injection', () => {
  it('uses provisional option A from landing-copy.json and escapes it as text', () => {
    expect(copy.status).toBe('draft')
    expect(copy.option).toBe('A')
    expect(copy.HERO_TITLE_PRE).toBe('¿Tenés claro')
    expect(copy.HERO_TITLE_EM).toBe('cómo está tu plata?')
    expect(copy.HERO_SIGN_PRE).toBe('Gota, tu plata')
    expect(copy.HERO_SIGN_EM).toBe('clara.')

    const html = renderLandingHtml(template, draftCopy, undefined)
    expect(html).toContain(
      `${copy.HERO_TITLE_PRE} <em>${copy.HERO_TITLE_EM}</em>`
    )
    expect(html).toContain(`<p class="hero-sub">${copy.HERO_SUB}</p>`)
    expect(html).toContain(
      `<p class="hero-sign2">${copy.HERO_SIGN_PRE} <span>${copy.HERO_SIGN_EM}</span></p>`
    )
    expect(html).toContain(`<title>${copy.META_TITLE}</title>`)
    expect(html).toContain(`content="${copy.META_DESCRIPTION}"`)
    expect(html).not.toMatch(/\{\{[A-Z0-9_]+\}\}/)
    expect(hrefs(html).filter((href) => href === '/start')).toHaveLength(3)
    expect(hrefs(html)).toEqual(
      expect.arrayContaining([
        '/login',
        '/privacy',
        '/terms',
        'mailto:facundo@gota.money',
      ])
    )
  })

  it('replaces exactly three CTAs and rejects an unsafe URL', () => {
    const html = renderLandingHtml(template, draftCopy, '/start?src=landing')
    expect(
      hrefs(html).filter((href) => href === '/start?src=landing')
    ).toHaveLength(3)
    expect(hrefs(html)).not.toContain('/start')

    const escaped = renderLandingHtml(
      template,
      { ...draftCopy, HERO_SUB: 'A & B <C> "D"' },
      '/start?a=1&b=2'
    )
    expect(escaped).toContain('A &amp; B &lt;C&gt; &quot;D&quot;')
    expect(escaped.match(/href="\/start\?a=1&amp;b=2"/g)).toHaveLength(3)

    expect(resolveLandingCtaUrl(undefined)).toBe('/start')
    expect(resolveLandingCtaUrl('   ')).toBe('/start')
    expect(resolveLandingCtaUrl('https://gota.money/start')).toBe(
      'https://gota.money/start'
    )
    for (const invalid of [
      'javascript:alert(1)',
      '//evil.test',
      'http://gota.money/start',
    ]) {
      expect(() => resolveLandingCtaUrl(invalid)).toThrow(
        /LANDING_CTA_URL inválida/
      )
    }
    expect(() =>
      renderLandingHtml('<a href="{{CTA_URL}}"></a>', draftCopy, '/start')
    ).toThrow(/Se esperaban 3 CTA/)
    expect(() =>
      renderLandingHtml(template, { ...draftCopy, HERO_SUB: '   ' }, '/start')
    ).toThrow(/HERO_SUB/)
    expect(() =>
      renderLandingHtml(template + '{{EXTRA}}', draftCopy, '/start')
    ).toThrow(/placeholder sin reemplazar/)
  })

  it('serves the rendered document with landing-only security headers', async () => {
    const response = GET()
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8'
    )
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=0, must-revalidate'
    )
    expect(response.headers.get('content-security-policy')).toContain(
      "default-src 'self'"
    )
    expect(response.headers.get('content-security-policy')).toContain(
      "font-src 'self'"
    )
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('referrer-policy')).toBe(
      'strict-origin-when-cross-origin'
    )
    const body = await response.text()
    const live = body.replace(/<!--[\s\S]*?-->/g, '')
    expect(body).toContain('id="sim-saldo"')
    expect(body).toContain(copy.HERO_TITLE_EM)
    expect(live).toContain('rel="canonical" href="https://gota.money/"')
    expect(live).toContain('name="twitter:card" content="summary"')
    expect(live).not.toMatch(/mockup|borrador/i)
    expect(live).not.toContain('og:image')
  })
})

describe('landing robots', () => {
  it('points crawlers at the gota.money sitemap', () => {
    const robots = readFileSync(
      join(process.cwd(), 'public/robots.txt'),
      'utf8'
    )
    expect(robots).toContain('Sitemap: https://gota.money/sitemap.xml')
    expect(robots).not.toContain('gota.app')
  })
})

type FakeEvent = {
  inputType?: string
  data?: string | null
  defaultPrevented: boolean
  preventDefault: () => void
}

type FakeEl = {
  value: string
  textContent: string
  style: { width?: string }
  selectionStart: number
  selectionEnd: number
  _cents?: boolean
  classNames: Set<string>
  classList: {
    toggle: (name: string, force?: boolean) => void
    contains: (name: string) => boolean
  }
  listeners: Record<string, Array<(event: FakeEvent) => void>>
  addEventListener: (type: string, fn: (event: FakeEvent) => void) => void
  setSelectionRange: (start: number, end: number) => void
}

function dispatch(el: FakeEl, type: string, event: FakeEvent) {
  for (const listener of el.listeners[type] ?? []) listener(event)
}

function makeEl(value = ''): FakeEl {
  const classNames = new Set<string>()
  const el: FakeEl = {
    value,
    textContent: '',
    style: {},
    selectionStart: 0,
    selectionEnd: 0,
    classNames,
    listeners: {},
    classList: {
      toggle(name, force) {
        const enable = force ?? !classNames.has(name)
        if (enable) classNames.add(name)
        else classNames.delete(name)
      },
      contains: (name) => classNames.has(name),
    },
    addEventListener(type, fn) {
      ;(el.listeners[type] ??= []).push(fn)
    },
    setSelectionRange(start, end) {
      el.selectionStart = start
      el.selectionEnd = end
    },
  }
  return el
}

function bootSimulator() {
  const elements = new Map<string, FakeEl>([
    ['sim-saldo', makeEl('500.000')],
    ['sim-tarjeta', makeEl('180.000')],
    ['disponible', makeEl()],
    ['bar-ok', makeEl()],
    ['bar-commit', makeEl()],
    ['eq-saldo', makeEl()],
    ['eq-tarjeta', makeEl()],
    ['eq-disp', makeEl()],
  ])
  const previous = globalThis.document
  globalThis.document = {
    getElementById: (id: string) => elements.get(id) ?? null,
  } as unknown as Document
  const script = template.match(/<script>\n([\s\S]*?)<\/script>/)?.[1]
  if (!script) throw new Error('falta el script del simulador')
  new Function(script)()
  globalThis.document = previous
  return elements
}

function fill(el: FakeEl, text: string) {
  el.value = text
  el.selectionStart = text.length
  el.selectionEnd = text.length
  dispatch(el, 'input', {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
  })
}

function typeChar(el: FakeEl, char: string) {
  el.selectionStart = el.value.length
  el.selectionEnd = el.value.length
  const event: FakeEvent = {
    inputType: 'insertText',
    data: char,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
  }
  dispatch(el, 'beforeinput', event)
  if (event.defaultPrevented) return
  el.value += char
  el.selectionStart = el.value.length
  dispatch(el, 'input', {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
  })
}

function backspace(el: FakeEl) {
  el.selectionStart = el.value.length
  el.selectionEnd = el.value.length
  const event: FakeEvent = {
    inputType: 'deleteContentBackward',
    data: null,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
  }
  dispatch(el, 'beforeinput', event)
  if (event.defaultPrevented) return
  el.value = el.value.slice(0, -1)
  el.selectionStart = el.value.length
  dispatch(el, 'input', {
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true
    },
  })
}

function equation(elements: Map<string, FakeEl>) {
  const minus = '\u2212'
  return `${elements.get('eq-saldo')?.textContent} ${minus} ${elements.get('eq-tarjeta')?.textContent} = ${elements.get('eq-disp')?.textContent}`
}

describe('landing simulator', () => {
  const cases: Array<{
    saldo: string
    tarjeta: string
    saldoLeft: string
    disponible: string
    neg: boolean
    equation: string
    bars: [string, string]
  }> = [
    {
      saldo: '500.000',
      tarjeta: '180.000',
      saldoLeft: '500.000',
      disponible: '$ 320.000',
      neg: false,
      equation: '$ 500.000 − $ 180.000 = $ 320.000',
      bars: ['64%', '36%'],
    },
    {
      saldo: '100.000',
      tarjeta: '180.000',
      saldoLeft: '100.000',
      disponible: 'Te faltan $ 80.000 para cubrir la tarjeta',
      neg: true,
      equation: '$ 100.000 − $ 180.000 = te faltan $ 80.000',
      bars: ['0%', '100%'],
    },
    {
      saldo: '500.000,50',
      tarjeta: '180.000',
      saldoLeft: '500.000',
      disponible: '$ 320.000',
      neg: false,
      equation: '$ 500.000 − $ 180.000 = $ 320.000',
      bars: ['64%', '36%'],
    },
    {
      saldo: '180.000',
      tarjeta: '180.000',
      saldoLeft: '180.000',
      disponible: '$ 0',
      neg: false,
      equation: '$ 180.000 − $ 180.000 = $ 0',
      bars: ['0%', '100%'],
    },
    {
      saldo: '0',
      tarjeta: '0',
      saldoLeft: '0',
      disponible: '$ 0',
      neg: false,
      equation: '$ 0 − $ 0 = $ 0',
      bars: ['0%', '0%'],
    },
    {
      saldo: '',
      tarjeta: '',
      saldoLeft: '',
      disponible: '$ 0',
      neg: false,
      equation: '$ 0 − $ 0 = $ 0',
      bars: ['0%', '0%'],
    },
    {
      saldo: '1234567',
      tarjeta: '0',
      saldoLeft: '1.234.567',
      disponible: '$ 1.234.567',
      neg: false,
      equation: '$ 1.234.567 − $ 0 = $ 1.234.567',
      bars: ['100%', '0%'],
    },
    {
      saldo: '999999999999',
      tarjeta: '1',
      saldoLeft: '999.999.999.999',
      disponible: '$ 999.999.999.998',
      neg: false,
      equation: '$ 999.999.999.999 − $ 1 = $ 999.999.999.998',
      bars: ['99.9999999999%', '1.000000000001e-10%'],
    },
    {
      saldo: '007.500',
      tarjeta: '2.500',
      saldoLeft: '7.500',
      disponible: '$ 5.000',
      neg: false,
      equation: '$ 7.500 − $ 2.500 = $ 5.000',
      bars: ['66.66666666666666%', '33.33333333333333%'],
    },
    {
      saldo: 'abc12x3',
      tarjeta: '0',
      saldoLeft: '123',
      disponible: '$ 123',
      neg: false,
      equation: '$ 123 − $ 0 = $ 123',
      bars: ['100%', '0%'],
    },
    {
      saldo: '1.000',
      tarjeta: '250',
      saldoLeft: '1.000',
      disponible: '$ 750',
      neg: false,
      equation: '$ 1.000 − $ 250 = $ 750',
      bars: ['75%', '25%'],
    },
    {
      saldo: '0',
      tarjeta: '50.000',
      saldoLeft: '0',
      disponible: 'Te faltan $ 50.000 para cubrir la tarjeta',
      neg: true,
      equation: '$ 0 − $ 50.000 = te faltan $ 50.000',
      bars: ['0%', '100%'],
    },
    {
      saldo: '300.000',
      tarjeta: '0',
      saldoLeft: '300.000',
      disponible: '$ 300.000',
      neg: false,
      equation: '$ 300.000 − $ 0 = $ 300.000',
      bars: ['100%', '0%'],
    },
  ]

  it('matches the initial example before any edit', () => {
    const elements = bootSimulator()
    expect(elements.get('sim-saldo')?.value).toBe('500.000')
    expect(elements.get('disponible')?.textContent).toBe('$ 320.000')
    expect(elements.get('disponible')?.classNames.has('neg')).toBe(false)
    expect(equation(elements)).toBe('$ 500.000 − $ 180.000 = $ 320.000')
    expect(elements.get('bar-ok')?.style.width).toBe('64%')
    expect(elements.get('bar-commit')?.style.width).toBe('36%')
  })

  it.each(cases)(
    'recalculates saldo $saldo and tarjeta $tarjeta',
    ({
      saldo,
      tarjeta,
      saldoLeft,
      disponible,
      neg,
      equation: expectedEquation,
      bars,
    }) => {
      const elements = bootSimulator()
      fill(elements.get('sim-saldo')!, saldo)
      fill(elements.get('sim-tarjeta')!, tarjeta)
      expect(elements.get('sim-saldo')?.value).toBe(saldoLeft)
      expect(elements.get('disponible')?.textContent).toBe(disponible)
      expect(elements.get('disponible')?.classNames.has('neg')).toBe(neg)
      expect(elements.get('eq-disp')?.classNames.has('neg')).toBe(neg)
      expect(equation(elements)).toBe(expectedEquation)
      expect(elements.get('bar-ok')?.style.width).toBe(bars[0])
      expect(elements.get('bar-commit')?.style.width).toBe(bars[1])
    }
  )

  it('blocks cents and non-digits, and accepts a digit after backspace', () => {
    const typed = bootSimulator()
    fill(typed.get('sim-saldo')!, '')
    for (const char of '500000,50') typeChar(typed.get('sim-saldo')!, char)
    expect(typed.get('sim-saldo')?.value).toBe('500.000')
    expect(typed.get('disponible')?.textContent).toBe('$ 320.000')
    expect(equation(typed)).toBe('$ 500.000 − $ 180.000 = $ 320.000')

    const dotted = bootSimulator()
    typeChar(dotted.get('sim-saldo')!, '.')
    typeChar(dotted.get('sim-saldo')!, 'a')
    expect(dotted.get('sim-saldo')?.value).toBe('500.000')

    const cents = bootSimulator()
    typeChar(cents.get('sim-saldo')!, ',')
    typeChar(cents.get('sim-saldo')!, '9')
    expect(cents.get('sim-saldo')?.value).toBe('500.000')

    const edited = bootSimulator()
    backspace(edited.get('sim-saldo')!)
    typeChar(edited.get('sim-saldo')!, '7')
    expect(edited.get('sim-saldo')?.value).toBe('500.007')
    expect(edited.get('disponible')?.textContent).toBe('$ 320.007')
  })
})
