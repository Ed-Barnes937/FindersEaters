// The admin creates a household with the CLI, and its user signs in over the
// production server's HTTP API (docs/spec/auth.md sections 4 to 6). The sign-in
// and Recipes screens join this flow when their designs land (#32).
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { serverEnv } from '../playwright.config.ts'

function adminCli(...args: string[]): string {
  return execFileSync('node', ['../server/src/cli.ts', ...args], {
    env: { ...process.env, ...serverEnv },
    encoding: 'utf8',
  })
}

function createHousehold(name: string) {
  const email = `e2e-${randomUUID()}@example.test`
  const out = adminCli('household', 'create', '--name', name, '--email', email, '--user-name', 'Ed')
  const password = /password \(shown once\): (\S+)/.exec(out)?.[1]
  if (!password) throw new Error(`no password in CLI output:\n${out}`)
  return { email, password }
}

test('a CLI-created user signs in and the API knows their household', async ({ request }) => {
  const { email, password } = createHousehold('E2E household')

  const signIn = await request.post('/api/auth/sign-in/email', {
    data: { email, password },
    headers: { origin: serverEnv.BETTER_AUTH_URL },
  })
  expect(signIn.status()).toBe(200)

  const me = await request.get('/trpc/account.me')
  expect(me.status()).toBe(200)
  expect(await me.json()).toMatchObject({
    result: { data: { user: { email, name: 'Ed' }, household: { name: 'E2E household' } } },
  })
})

test('a wrong password gets no session', async ({ request }) => {
  const { email } = createHousehold('E2E wrong password')

  const signIn = await request.post('/api/auth/sign-in/email', {
    data: { email, password: 'not-the-right-password' },
    headers: { origin: serverEnv.BETTER_AUTH_URL },
  })
  expect(signIn.status()).toBe(401)

  expect((await request.get('/trpc/account.me')).status()).toBe(401)
})
