import { expect, test, type Locator, type Page } from '@playwright/test'

const minus = '\u2212'

async function read(page: Page) {
  return page.evaluate((dash) => {
    const saldo = document.querySelector('#sim-saldo') as HTMLInputElement
    const disponible = document.querySelector('#disponible') as HTMLElement
    const eq = document.querySelector('#eq-disp') as HTMLElement
    return {
      saldo: saldo.value,
      disponible: disponible.textContent,
      neg: disponible.classList.contains('neg'),
      eqNeg: eq.classList.contains('neg'),
      equation: (
        document.querySelector('#sim-eq') as HTMLElement
      ).innerText.replace(/\s+/g, ' '),
      ok: (document.querySelector('#bar-ok') as HTMLElement).style.width,
      commit: (document.querySelector('#bar-commit') as HTMLElement).style
        .width,
      dash,
    }
  }, minus)
}

async function fillBoth(page: Page, saldo: string, tarjeta: string) {
  await page.locator('#sim-saldo').fill(saldo)
  await page.locator('#sim-tarjeta').fill(tarjeta)
}

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
    equation: `$ 500.000 ${minus} $ 180.000 = $ 320.000`,
    bars: ['64%', '36%'],
  },
  {
    saldo: '100.000',
    tarjeta: '180.000',
    saldoLeft: '100.000',
    disponible: 'Te faltan $ 80.000 para cubrir la tarjeta',
    neg: true,
    equation: `$ 100.000 ${minus} $ 180.000 = te faltan $ 80.000`,
    bars: ['0%', '100%'],
  },
  {
    saldo: '500.000,50',
    tarjeta: '180.000',
    saldoLeft: '500.000',
    disponible: '$ 320.000',
    neg: false,
    equation: `$ 500.000 ${minus} $ 180.000 = $ 320.000`,
    bars: ['64%', '36%'],
  },
  {
    saldo: '180.000',
    tarjeta: '180.000',
    saldoLeft: '180.000',
    disponible: '$ 0',
    neg: false,
    equation: `$ 180.000 ${minus} $ 180.000 = $ 0`,
    bars: ['0%', '100%'],
  },
  {
    saldo: '0',
    tarjeta: '0',
    saldoLeft: '0',
    disponible: '$ 0',
    neg: false,
    equation: `$ 0 ${minus} $ 0 = $ 0`,
    bars: ['0%', '0%'],
  },
  {
    saldo: '',
    tarjeta: '',
    saldoLeft: '',
    disponible: '$ 0',
    neg: false,
    equation: `$ 0 ${minus} $ 0 = $ 0`,
    bars: ['0%', '0%'],
  },
  {
    saldo: '1234567',
    tarjeta: '0',
    saldoLeft: '1.234.567',
    disponible: '$ 1.234.567',
    neg: false,
    equation: `$ 1.234.567 ${minus} $ 0 = $ 1.234.567`,
    bars: ['100%', '0%'],
  },
  {
    saldo: '999999999999',
    tarjeta: '1',
    saldoLeft: '999.999.999.999',
    disponible: '$ 999.999.999.998',
    neg: false,
    equation: `$ 999.999.999.999 ${minus} $ 1 = $ 999.999.999.998`,
    bars: ['100%', '1e-10%'],
  },
  {
    saldo: '007.500',
    tarjeta: '2.500',
    saldoLeft: '7.500',
    disponible: '$ 5.000',
    neg: false,
    equation: `$ 7.500 ${minus} $ 2.500 = $ 5.000`,
    bars: ['66.6667%', '33.3333%'],
  },
  {
    saldo: 'abc12x3',
    tarjeta: '0',
    saldoLeft: '123',
    disponible: '$ 123',
    neg: false,
    equation: `$ 123 ${minus} $ 0 = $ 123`,
    bars: ['100%', '0%'],
  },
  {
    saldo: '1.000',
    tarjeta: '250',
    saldoLeft: '1.000',
    disponible: '$ 750',
    neg: false,
    equation: `$ 1.000 ${minus} $ 250 = $ 750`,
    bars: ['75%', '25%'],
  },
  {
    saldo: '0',
    tarjeta: '50.000',
    saldoLeft: '0',
    disponible: 'Te faltan $ 50.000 para cubrir la tarjeta',
    neg: true,
    equation: `$ 0 ${minus} $ 50.000 = te faltan $ 50.000`,
    bars: ['0%', '100%'],
  },
  {
    saldo: '300.000',
    tarjeta: '0',
    saldoLeft: '300.000',
    disponible: '$ 300.000',
    neg: false,
    equation: `$ 300.000 ${minus} $ 0 = $ 300.000`,
    bars: ['100%', '0%'],
  },
]

function expectState(
  state: Awaited<ReturnType<typeof read>>,
  expected: (typeof cases)[number]
) {
  expect(state.saldo).toBe(expected.saldoLeft)
  expect(state.disponible).toBe(expected.disponible)
  expect(state.neg).toBe(expected.neg)
  expect(state.eqNeg).toBe(expected.neg)
  expect(state.equation).toBe(expected.equation)
  expect(state.ok).toBe(expected.bars[0])
  expect(state.commit).toBe(expected.bars[1])
}

async function typeAtEnd(locator: Locator, key: string) {
  await locator.evaluate((el) => {
    const input = el as HTMLInputElement
    input.focus()
    input.setSelectionRange(input.value.length, input.value.length)
  })
  await locator.press(key)
}

test('initial example and the 13 edited cases', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const initial = await read(page)
  expect(initial.saldo).toBe('500.000')
  expect(initial.disponible).toBe('$ 320.000')
  expect(initial.neg).toBe(false)
  expect(initial.equation).toBe(`$ 500.000 ${minus} $ 180.000 = $ 320.000`)
  expect(initial.ok).toBe('64%')
  expect(initial.commit).toBe('36%')

  for (const item of cases) {
    await page.reload({ waitUntil: 'networkidle' })
    await fillBoth(page, item.saldo, item.tarjeta)
    expectState(await read(page), item)
  }
})

test('keyboard blocks cents and non-digits', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' })
  const saldo = page.locator('#sim-saldo')
  await saldo.fill('')
  await saldo.pressSequentially('500000,50')
  let state = await read(page)
  expect(state.saldo).toBe('500.000')
  expect(state.disponible).toBe('$ 320.000')
  expect(state.equation).toBe(`$ 500.000 ${minus} $ 180.000 = $ 320.000`)

  await page.reload({ waitUntil: 'networkidle' })
  await typeAtEnd(saldo, '.')
  await typeAtEnd(saldo, 'a')
  expect((await read(page)).saldo).toBe('500.000')

  await typeAtEnd(saldo, ',')
  await typeAtEnd(saldo, '9')
  expect((await read(page)).saldo).toBe('500.000')

  await typeAtEnd(saldo, 'Backspace')
  await typeAtEnd(saldo, '7')
  state = await read(page)
  expect(state.saldo).toBe('500.007')
  expect(state.disponible).toBe('$ 320.007')
})
