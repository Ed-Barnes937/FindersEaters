// The PWA plumbing (docs/spec/v0.1.md section 4, #33): installable manifest,
// an app shell that loads offline after the first visit, a service worker that
// never takes over mid-session, and a mutation queue that survives a reload
// offline and replays on reconnect. Offline is Playwright's offline context.
import { expect, test, type Page } from '@playwright/test'

/** First visit, then a reload so the page is under the service worker. */
async function visitUnderServiceWorker(page: Page, path = '/') {
  await page.goto(path)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

/** The persisted queue as the next page load would find it. */
function persistedMutations(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('finders-eaters')
        open.onerror = () => reject(new Error('indexedDB open failed'))
        open.onsuccess = () => {
          const db = open.result
          if (!db.objectStoreNames.contains('query-cache')) return resolve(0)
          const req = db.transaction('query-cache').objectStore('query-cache').get('client')
          req.onerror = () => reject(new Error('indexedDB read failed'))
          req.onsuccess = () => {
            db.close()
            const record = req.result as { clientState?: { mutations?: unknown[] } } | undefined
            resolve(record?.clientState?.mutations?.length ?? 0)
          }
        }
      }),
  )
}

test('the manifest makes the app installable and standalone', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBe('/manifest.webmanifest')

  const res = await request.get('/manifest.webmanifest')
  expect(res.status()).toBe(200)
  const manifest = (await res.json()) as { icons: { src: string }[] }
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', scope: '/' })
  for (const icon of manifest.icons) {
    const img = await request.get(icon.src)
    expect(img.status(), icon.src).toBe(200)
    expect(img.headers()['content-type']).toBe('image/png')
  }
})

test('a new service worker is never forced over a running session', async ({ request }) => {
  const res = await request.get('/sw.js')
  expect(res.status()).toBe(200)
  const source = await res.text()
  expect(source).not.toMatch(/skipWaiting|clientsClaim|clients\.claim/)
})

test('the app shell loads offline after the first visit, deep links included', async ({
  page,
  context,
}) => {
  await visitUnderServiceWorker(page)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Finders Eaters' })).toBeVisible()

  await page.goto('/recipes')
  await expect(page.getByRole('heading', { level: 1, name: 'Finders Eaters' })).toBeVisible()
})

test('a mutation made offline survives a reload and replays on reconnect', async ({
  page,
  context,
}) => {
  const received: unknown[] = []
  await context.route('**/api/offline-probe', async (route) => {
    received.push(route.request().postDataJSON())
    await route.fulfill({ status: 204 })
  })
  await visitUnderServiceWorker(page)

  await context.setOffline(true)
  await page.evaluate(() => {
    const { queryClient } = (
      window as unknown as { __fe: { queryClient: import('@tanstack/react-query').QueryClient } }
    ).__fe
    void queryClient
      .getMutationCache()
      .build(queryClient, { mutationKey: ['offline-probe'] })
      .execute({ id: 'tick-1' })
  })
  await expect.poll(() => persistedMutations(page)).toBe(1)

  await page.reload() // still offline
  await expect.poll(() => persistedMutations(page)).toBe(1)
  expect(received).toEqual([])

  await context.setOffline(false)
  await expect.poll(() => received).toEqual([{ id: 'tick-1' }])
  await expect.poll(() => persistedMutations(page)).toBe(0)
})
