// Signing in over HTTP with an account the admin CLI made (docs/spec/auth.md
// sections 2 to 4 and 6).
import { describe, expect } from 'vitest'

import { printedPassword, serverTest, signIn, testAuthConfig, uniqueEmail } from '../testing.ts'

describe('sign in', () => {
  serverTest(
    'a user the CLI created signs in with the printed password',
    async ({ cli, server }) => {
      const email = uniqueEmail('ed')
      const created = await cli([
        'household',
        'create',
        '--name',
        'The Barneses',
        '--email',
        email,
        '--user-name',
        'Ed',
      ])
      expect(created).toMatchObject({ code: 0, stderr: '' })

      const res = await signIn(server, email, printedPassword(created))

      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ user: { email, name: 'Ed' } })
    },
  )

  serverTest('a wrong password is refused without a session', async ({ cli, server }) => {
    const email = uniqueEmail()
    await cli(['household', 'create', '--name', 'Home', '--email', email, '--user-name', 'Ed'])

    const res = await signIn(server, email, 'not-the-right-password')

    expect(res.statusCode).toBe(401)
    expect(res.cookies.filter((c) => c.name.endsWith('session_token'))).toEqual([])
  })

  serverTest('there is no public sign-up', async ({ server }) => {
    const email = uniqueEmail()

    const signUp = await server.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: testAuthConfig.baseURL, 'content-type': 'application/json' },
      payload: { email, password: 'a-long-enough-password', name: 'Stranger' },
    })

    expect(signUp.statusCode).toBe(400)
    expect((await signIn(server, email, 'a-long-enough-password')).statusCode).toBe(401)
  })
})
