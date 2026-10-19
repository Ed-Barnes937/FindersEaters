// Better Auth's session, account and verification tables (docs/spec/auth.md
// section 2), checked against the migrated database.
import { eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { dbTest } from '../testing/db-test.ts'
import { addUser, createHousehold } from '../testing/fixtures.ts'
import { account, session, user } from './index.ts'

describe('auth tables', () => {
  dbTest('removing a user removes their sessions and credentials', async ({ db }) => {
    const home = await createHousehold(db)
    const person = await addUser(db, home.id)
    await db.insert(session).values({
      userId: person.id,
      token: `token-${person.id}`,
      expiresAt: new Date(Date.now() + 60_000),
    })
    await db.insert(account).values({
      userId: person.id,
      accountId: person.id,
      providerId: 'credential',
      password: 'hash',
    })

    await db.delete(user).where(eq(user.id, person.id))

    expect(await db.select().from(session).where(eq(session.userId, person.id))).toEqual([])
    expect(await db.select().from(account).where(eq(account.userId, person.id))).toEqual([])
  })

  dbTest('a session token is unique', async ({ db }) => {
    const home = await createHousehold(db)
    const person = await addUser(db, home.id)
    const values = {
      userId: person.id,
      token: `token-${person.id}`,
      expiresAt: new Date(Date.now() + 60_000),
    }
    await db.insert(session).values(values)

    await expect(db.transaction((tx) => tx.insert(session).values(values))).rejects.toThrow()
  })
})
