import { expect, test } from '@playwright/test'

test('the production build serves the app shell on a phone', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  await page.goto('/')

  await expect(page).toHaveTitle('Finders Eaters')
  await expect(page.getByRole('heading', { level: 1, name: 'Finders Eaters' })).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow, 'no horizontal scroll at 390 px').toBe(0)
  expect(errors).toEqual([])
})

test('/health reports the database round-trip after the release step', async ({ request }) => {
  const res = await request.get('/health')

  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ status: 'ok', database: { ok: true } })
})

test('a deep link loads the app shell instead of a server 404', async ({ page }) => {
  const res = await page.goto('/recipes')

  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1, name: 'Finders Eaters' })).toBeVisible()
})
