// The admin CLI (docs/spec/auth.md section 4), driven as the admin would and
// checked through what users then can and cannot do over HTTP.
import { getHousehold, householdIdOfUser } from '@finders-eaters/db'
import type { FastifyInstance } from 'fastify'
import { describe, expect } from 'vitest'

import {
  printedPassword,
  serverTest,
  sessionCookie,
  signedInUser,
  signIn,
  uniqueEmail,
  type Cli,
} from '../testing.ts'

function me(server: FastifyInstance, cookie: string) {
  return server.inject({ method: 'GET', url: '/trpc/account.me', headers: { cookie } })
}

async function createHousehold(cli: Cli, extra: string[] = []) {
  const email = uniqueEmail()
  const result = await cli([
    'household',
    'create',
    '--name',
    'Home',
    '--email',
    email,
    '--user-name',
    'Ed',
    ...extra,
  ])
  const householdId = /\(id ([0-9a-f-]+), timezone/.exec(result.stdout)?.[1]
  return { result, email, householdId }
}

describe('household create', () => {
  serverTest('defaults the household timezone to Europe/London', async ({ cli, db }) => {
    const { result, householdId } = await createHousehold(cli)

    expect(result.code).toBe(0)
    expect(await getHousehold(db, householdId!)).toMatchObject({ timezone: 'Europe/London' })
  })

  serverTest('takes another IANA timezone', async ({ cli, db }) => {
    const { householdId } = await createHousehold(cli, ['--timezone', 'America/New_York'])

    expect(await getHousehold(db, householdId!)).toMatchObject({ timezone: 'America/New_York' })
  })

  serverTest('refuses an unknown timezone', async ({ cli }) => {
    const { result } = await createHousehold(cli, ['--timezone', 'Mars/Olympus'])

    expect(result).toMatchObject({ code: 1, stdout: '' })
    expect(result.stderr).toMatch(/Unknown timezone "Mars\/Olympus"/)
  })

  serverTest('prints a first password of at least 12 characters, once', async ({ cli }) => {
    const { result } = await createHousehold(cli)

    const password = printedPassword(result)
    expect(password.length).toBeGreaterThanOrEqual(12)
    expect(result.stdout.split(password)).toHaveLength(2)
  })

  serverTest('makes nothing when the email is taken', async ({ cli, server }) => {
    const first = await createHousehold(cli)

    const again = await cli([
      'household',
      'create',
      '--name',
      'Second home',
      '--email',
      first.email.toUpperCase(),
      '--user-name',
      'Someone',
    ])

    expect(again.code).toBe(1)
    expect(again.stderr).toMatch(/already exists/)
    const res = await signIn(server, first.email, printedPassword(first.result))
    expect((await me(server, sessionCookie(res))).json()).toMatchObject({
      result: { data: { household: { name: 'Home' } } },
    })
  })

  serverTest('stores the email in lower case, so sign-in ignores case', async ({ cli, server }) => {
    const email = uniqueEmail('Mixed.Case')
    const result = await cli([
      'household',
      'create',
      '--name',
      'H',
      '--email',
      email,
      '--user-name',
      'Ed',
    ])

    expect((await signIn(server, email.toLowerCase(), printedPassword(result))).statusCode).toBe(
      200,
    )
  })

  serverTest('explains a missing option', async ({ cli }) => {
    const result = await cli(['household', 'create', '--name', 'Home'])

    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/Missing --email/)
  })
})

describe('user add', () => {
  serverTest('adds a second user who shares the household', async ({ cli, server }) => {
    const first = await signedInUser(cli, server, 'Shared home')
    const email = uniqueEmail('partner')

    const added = await cli([
      'user',
      'add',
      '--household',
      first.householdId,
      '--email',
      email,
      '--name',
      'Partner',
    ])
    expect(added.code).toBe(0)
    const res = await signIn(server, email, printedPassword(added))

    expect((await me(server, sessionCookie(res))).json()).toMatchObject({
      result: {
        data: {
          user: { name: 'Partner', email },
          household: { id: first.householdId, name: 'Shared home' },
        },
      },
    })
  })

  serverTest('refuses a household that does not exist', async ({ cli }) => {
    const email = uniqueEmail()
    const result = await cli([
      'user',
      'add',
      '--household',
      '01890000-0000-7000-8000-000000000000',
      '--email',
      email,
      '--name',
      'Nobody',
    ])

    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/No household with id/)
    expect(result.stdout).toBe('')
  })
})

describe('user set-password', () => {
  serverTest('replaces the password and signs out every device', async ({ cli, server }) => {
    const user = await signedInUser(cli, server)

    const reset = await cli(['user', 'set-password', '--email', user.email])

    expect(reset.code).toBe(0)
    expect((await me(server, user.cookie)).statusCode).toBe(401)
    expect((await signIn(server, user.email, printedPassword(reset))).statusCode).toBe(200)
  })

  serverTest('refuses an unknown email', async ({ cli }) => {
    const result = await cli(['user', 'set-password', '--email', uniqueEmail()])

    expect(result.code).toBe(1)
    expect(result.stderr).toMatch(/No user with email/)
  })
})

describe('user sign-out-all', () => {
  serverTest('signs out every device and keeps the password', async ({ cli, server }) => {
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
    const password = printedPassword(created)
    const phone = sessionCookie(await signIn(server, email, password))
    const laptop = sessionCookie(await signIn(server, email, password))

    const result = await cli(['user', 'sign-out-all', '--email', email])

    expect(result.code).toBe(0)
    expect((await me(server, phone)).statusCode).toBe(401)
    expect((await me(server, laptop)).statusCode).toBe(401)
    expect((await signIn(server, email, password)).statusCode).toBe(200)
  })
})

describe('user remove', () => {
  serverTest(
    'deletes the user and their sessions and keeps the household',
    async ({ cli, server, db }) => {
      const first = await signedInUser(cli, server)
      const partnerEmail = uniqueEmail('partner')
      const added = await cli([
        'user',
        'add',
        '--household',
        first.householdId,
        '--email',
        partnerEmail,
        '--name',
        'Partner',
      ])
      const partnerCookie = sessionCookie(
        await signIn(server, partnerEmail, printedPassword(added)),
      )

      const result = await cli(['user', 'remove', '--email', partnerEmail])

      expect(result.code).toBe(0)
      expect((await me(server, partnerCookie)).statusCode).toBe(401)
      expect((await signIn(server, partnerEmail, printedPassword(added))).statusCode).toBe(401)
      expect((await me(server, first.cookie)).statusCode).toBe(200)
      expect(await householdIdOfUser(db, first.userId)).toBe(first.householdId)
    },
  )
})

describe('usage', () => {
  serverTest('an unknown command prints usage and exits 2', async ({ cli }) => {
    const result = await cli(['household', 'explode'])

    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(/Usage:/)
  })
})
