// Every tRPC request resolves session to user to household once, into a typed
// principal; handlers never read a household id from input (docs/spec/auth.md
// sections 5 and 8).
import { eq, householdUser } from '@finders-eaters/db'
import type { FastifyInstance } from 'fastify'
import { describe, expect } from 'vitest'

import { serverTest, signedInUser } from '../testing.ts'
import { appRouter } from './router.ts'

function query(server: FastifyInstance, path: string, cookie?: string, input?: unknown) {
  const search = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify(input))}`
  return server.inject({
    method: 'GET',
    url: `/trpc/${path}${search}`,
    headers: cookie ? { cookie } : {},
  })
}

describe('tRPC principal', () => {
  serverTest('a signed-in user reads their own household and account', async ({ cli, server }) => {
    const me = await signedInUser(cli, server, 'The Barneses')

    const res = await query(server, 'account.me', me.cookie)

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      result: {
        data: {
          user: { id: me.userId, name: 'Ed', email: me.email },
          household: { id: me.householdId, name: 'The Barneses', defaultServings: 2 },
        },
      },
    })
  })

  serverTest.for(Object.keys(appRouter._def.procedures))(
    '%s rejects a request with no session',
    async (path, { server }) => {
      const res = await query(server, path)

      expect(res.statusCode).toBe(401)
      expect(res.json()).toMatchObject({ error: { data: { code: 'UNAUTHORIZED' } } })
    },
  )

  serverTest(
    'a household id in the input cannot reach another household',
    async ({ cli, server }) => {
      const mine = await signedInUser(cli, server, 'Mine')
      const theirs = await signedInUser(cli, server, 'Theirs')

      const res = await query(server, 'account.me', mine.cookie, {
        householdId: theirs.householdId,
      })

      expect(res.json()).toMatchObject({
        result: { data: { household: { id: mine.householdId, name: 'Mine' } } },
      })
      const theirView = await query(server, 'account.me', theirs.cookie)
      expect(theirView.json()).toMatchObject({
        result: { data: { household: { id: theirs.householdId, name: 'Theirs' } } },
      })
    },
  )

  serverTest('a session whose user has no household is forbidden', async ({ cli, server, db }) => {
    const me = await signedInUser(cli, server)
    await db.delete(householdUser).where(eq(householdUser.userId, me.userId))

    const res = await query(server, 'account.me', me.cookie)

    expect(res.statusCode).toBe(403)
    expect(res.json()).toMatchObject({
      error: { message: 'Account not set up', data: { code: 'FORBIDDEN' } },
    })
  })
})
