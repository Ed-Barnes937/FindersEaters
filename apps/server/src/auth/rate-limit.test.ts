// Sign-in is rate-limited per client address (docs/spec/auth.md section 2):
// five attempts a minute, keyed by the address the Fly proxy appended.
import { describe, expect } from 'vitest'

import {
  clientAddress,
  printedPassword,
  serverTest,
  signIn,
  testAuthConfig,
  uniqueEmail,
  type Cli,
} from '../testing.ts'

async function createUser(cli: Cli) {
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
  return { email, password: printedPassword(created) }
}

describe('sign-in rate limit', () => {
  serverTest(
    'the sixth attempt in a minute from one address is refused',
    async ({ cli, server }) => {
      const { email, password } = await createUser(cli)
      const address = clientAddress()

      for (let attempt = 1; attempt <= 5; attempt++) {
        expect(
          (await signIn(server, email, 'wrong-password-123', { remoteAddress: address }))
            .statusCode,
        ).toBe(401)
      }
      const sixth = await signIn(server, email, password, { remoteAddress: address })

      expect(sixth.statusCode).toBe(429)
      expect(sixth.cookies).toEqual([])
      expect(
        (await signIn(server, email, password, { remoteAddress: clientAddress() })).statusCode,
      ).toBe(200)
    },
  )

  serverTest(
    'a client cannot pick its own bucket with forwarding headers',
    async ({ cli, server }) => {
      const { email, password } = await createUser(cli)
      const proxy = clientAddress()
      const realClient = clientAddress()

      const attempt = (pw: string) =>
        server.inject({
          method: 'POST',
          url: '/api/auth/sign-in/email',
          remoteAddress: proxy,
          headers: {
            origin: testAuthConfig.baseURL,
            'content-type': 'application/json',
            // The client's own claim, then the address the proxy appended.
            'x-forwarded-for': `${clientAddress()}, ${realClient}`,
            'x-fe-client-ip': clientAddress(),
          },
          payload: { email, password: pw },
        })

      for (let i = 1; i <= 5; i++)
        expect((await attempt('wrong-password-123')).statusCode).toBe(401)

      expect((await attempt(password)).statusCode).toBe(429)
    },
  )
})
