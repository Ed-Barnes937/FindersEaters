// The ownership core and the column conventions (docs/spec/data-model.md
// sections 2 and 3), checked against the migrated database.
import { eq } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { listHouseholdUsers } from '../access/household.ts'
import { dbTest } from '../testing/db-test.ts'
import { addUser, createHousehold } from '../testing/fixtures.ts'
import { newId } from './columns.ts'
import { household, householdUser, user } from './index.ts'

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('household', () => {
  dbTest('defaults to two servings, Europe/London and UK metric', async ({ db }) => {
    const row = await createHousehold(db, { name: 'The Barneses' })

    expect(row).toMatchObject({
      name: 'The Barneses',
      defaultServings: 2,
      timezone: 'Europe/London',
      units: 'uk_metric',
    })
    expect(row.createdAt).toBeInstanceOf(Date)
  })
})

describe('ids', () => {
  dbTest('are UUIDv7 minted by the app when the client supplies none', async ({ db }) => {
    const first = await createHousehold(db)
    const second = await createHousehold(db)

    expect(first.id).toMatch(uuidV7)
    expect(second.id).toMatch(uuidV7)
    expect(second.id > first.id).toBe(true)
  })

  dbTest('a client-supplied id is kept, and replaying the insert is a no-op', async ({ db }) => {
    const id = newId()
    const insert = () =>
      db.insert(household).values({ id, name: 'Replayed' }).onConflictDoNothing().returning()

    expect(await insert()).toEqual([expect.objectContaining({ id, name: 'Replayed' })])
    expect(await insert()).toEqual([])
    expect(await db.select().from(household).where(eq(household.id, id))).toHaveLength(1)
  })
})

describe('household_user', () => {
  dbTest('a user belongs to at most one household', async ({ db }) => {
    const mine = await createHousehold(db)
    const theirs = await createHousehold(db)
    const person = await addUser(db, mine.id)

    await expect(
      db.transaction((tx) =>
        tx.insert(householdUser).values({ householdId: theirs.id, userId: person.id }),
      ),
    ).rejects.toThrow()
  })

  dbTest('a household can have several users', async ({ db }) => {
    const home = await createHousehold(db)
    await addUser(db, home.id, { name: 'Ed' })
    await addUser(db, home.id, { name: 'Partner' })

    expect((await listHouseholdUsers(db, home.id)).map((u) => u.name)).toEqual(['Ed', 'Partner'])
  })

  dbTest('removing a user removes their membership', async ({ db }) => {
    const home = await createHousehold(db)
    const person = await addUser(db, home.id)

    await db.delete(user).where(eq(user.id, person.id))

    expect(await listHouseholdUsers(db, home.id)).toEqual([])
  })
})
