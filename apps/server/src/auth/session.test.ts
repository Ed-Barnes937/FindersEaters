// The session cookie and its lifetime (docs/spec/auth.md section 6): 90 days,
// sliding (renewed when older than a day), HttpOnly, SameSite=Lax, Secure on
// https, and read from the database on every request.
import { eq, session } from '@finders-eaters/db'
import { describe, expect } from 'vitest'

import {
  printedPassword,
  serverTest,
  signedInUser,
  signIn,
  testAuthConfig,
  uniqueEmail,
} from '../testing.ts'

const DAY_MS = 24 * 60 * 60 * 1000

function getSession(server: Parameters<typeof signIn>[0], cookie: string) {
  return server.inject({ method: 'GET', url: '/api/auth/get-session', headers: { cookie } })
}

describe('session cookie', () => {
  serverTest('lasts 90 days and is HttpOnly and SameSite=Lax', async ({ cli, server }) => {
    const email = uniqueEmail()
    const created = await cli([
      'household',
      'create',
      '--name',
      'H',
      '--email',
      email,
      '--user-name',
      'Ed',
    ])

    const res = await signIn(server, email, printedPassword(created))
    const cookie = res.cookies.find((c) => c.name.endsWith('session_token'))

    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: (90 * DAY_MS) / 1000,
    })
    expect(cookie?.domain).toBeUndefined()
  })
})

describe('session cookie over https', () => {
  serverTest.scoped({ auth: { ...testAuthConfig, baseURL: 'https://app.example.test' } })

  serverTest('is Secure when the app is served over https', async ({ cli, server }) => {
    const email = uniqueEmail()
    const created = await cli([
      'household',
      'create',
      '--name',
      'H',
      '--email',
      email,
      '--user-name',
      'Ed',
    ])

    const res = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: 'https://app.example.test', 'content-type': 'application/json' },
      payload: { email, password: printedPassword(created) },
    })

    expect(res.statusCode).toBe(200)
    expect(res.cookies.find((c) => c.name.endsWith('session_token'))).toMatchObject({
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    })
  })
})

describe('session lifetime', () => {
  serverTest(
    'slides: a session over a day old is renewed to 90 days',
    async ({ cli, server, db }) => {
      const { cookie, userId } = await signedInUser(cli, server)
      const twoDaysOld = new Date(Date.now() + 88 * DAY_MS)
      await db.update(session).set({ expiresAt: twoDaysOld }).where(eq(session.userId, userId))

      const res = await getSession(server, cookie)

      expect(res.statusCode).toBe(200)
      const expiresAt = new Date(res.json<{ session: { expiresAt: string } }>().session.expiresAt)
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 89 * DAY_MS)
    },
  )

  serverTest('a deleted session row signs the device out at once', async ({ cli, server, db }) => {
    const { cookie, userId } = await signedInUser(cli, server)
    expect((await getSession(server, cookie)).json()).toMatchObject({ user: { id: userId } })

    await db.delete(session).where(eq(session.userId, userId))

    expect((await getSession(server, cookie)).json()).toBeNull()
  })
})
