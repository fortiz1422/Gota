// Render the supplied mockups with their original markup and a local DM Sans.
// Intended for private QA: requires the user-supplied HTML directory.
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
const source = process.env.GOTA_MOCKUPS_ROOT
if (!source)
  throw new Error('Set GOTA_MOCKUPS_ROOT to the supplied mockup HTML directory')
const dest = process.env.GOTA_REFERENCE_OUTPUT ?? '/tmp/gota-reference'
fs.mkdirSync(dest, { recursive: true })
const font = fs
  .readFileSync(
    process.env.GOTA_QA_DM_SANS ??
      '/tmp/gota-fonts/node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2'
  )
  .toString('base64')
const browser = await chromium.launch({
  executablePath: process.env.FORMS_CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const mapping = [
  ['transferencia-completa', 1, 'transfer'],
  ['ingreso-v3', 1, 'income'],
  ['ingreso-edicion', 0, 'income-edit'],
  ['gasto-edicion-v2', 0, 'expense'],
  ['suscripcion-inicio', 0, 'subscription-home'],
  ['fondo-claro-r', 0, 'account-edit'],
  ['fondo-claro-r', 2, 'subscription-edit'],
  ['fondo-claro-r2', 1, 'accounts-filled'],
  ['fondo-claro-r2', 2, 'subscriptions-filled'],
  ['analisis-metas-presupuesto', 1, 'budget-edit'],
  ['analisis-metas-presupuesto', 0, 'goal-detail'],
]
for (const [file, index, label] of mapping) {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    locale: 'es-AR',
    reducedMotion: 'reduce',
  })
  await page.route('https://**/*', (route) => route.abort())
  await page.setContent(
    fs.readFileSync(path.join(source, file + '.html'), 'utf8'),
    { waitUntil: 'domcontentloaded' }
  )
  await page.addStyleTag({
    content: `@font-face{font-family:'DM Sans';font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${font}) format('woff2')}body{padding:0!important;margin:0!important;display:block!important;background:#f8fbfd!important}.col{display:none!important}.col:nth-of-type(${index + 1}){display:block!important;width:390px!important}.cap{display:none!important}.ph{width:390px!important;height:844px!important;border-radius:0!important;box-shadow:none!important}`,
  })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: path.join(dest, label + '.png') })
  await page.close()
}
await browser.close()
console.log(
  `Rendered ${mapping.length} reference panels at 390×844. Device frame adapted to viewport; component markup unchanged.`
)
