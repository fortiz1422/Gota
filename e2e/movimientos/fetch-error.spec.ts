import { expect, test } from '@playwright/test'

test('fetch !ok muestra banner con Reintentar y no la lista previa', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.route('**/api/movimientos?**', (route) =>
    route.fulfill({ status: 500, json: { error: 'fallo simulado' } })
  )

  await page.goto('/ui-exploration/movimientos-ux-a')
  await expect(page.getByText('Café de prueba UX', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Mes anterior' }).click()

  const errorBanner = page.getByRole('alert').filter({ hasText: 'No pudimos cargar los movimientos' })
  await expect(errorBanner).toBeVisible()
  await expect(errorBanner.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  await expect(page.getByText('Café de prueba UX', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Sin movimientos para este período')).toHaveCount(0)

  expect(errors).toEqual([])
})
