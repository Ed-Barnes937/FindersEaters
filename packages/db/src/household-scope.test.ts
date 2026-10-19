// The household-scope test (docs/spec/data-model.md section 2): every
// household-owned table is read only through the household-scoped data-access
// layer, and every read returns that household's rows and nobody else's.
//
// Adding a table: add a row to `householdOwned` (seed rows for one household,
// read them back through the data-access function), or to `notHouseholdOwned`
// with the reason. The classification test fails until one of them is done.
import { sql } from 'drizzle-orm'
import { describe, expect } from 'vitest'
import { getHousehold, listHouseholdUsers } from './access/household.ts'
import type { Db } from './client.ts'
import { dbTest } from './testing/db-test.ts'
import { addUser, createHousehold } from './testing/fixtures.ts'

interface ScopeCase {
  /** Creates this table's rows for one household and returns their ids. */
  seed: (db: Db, householdId: string) => Promise<string[]>
  /** Reads the table through the data-access layer as that household. */
  read: (db: Db, householdId: string) => Promise<string[]>
}

const householdOwned: Record<string, ScopeCase> = {
  household: {
    seed: (_db, householdId) => Promise.resolve([householdId]),
    read: async (db, householdId) => {
      const row = await getHousehold(db, householdId)
      return row ? [row.id] : []
    },
  },
  household_user: {
    seed: async (db, householdId) => [
      (await addUser(db, householdId)).id,
      (await addUser(db, householdId)).id,
    ],
    read: async (db, householdId) => (await listHouseholdUsers(db, householdId)).map((u) => u.id),
  },
}

const notHouseholdOwned: Record<string, string> = {
  'public.user': 'Identity across households; reached only through household_user.',
}

describe('household scope', () => {
  dbTest('every table is classified as household-owned or not', async ({ db }) => {
    const result = await db.execute<{ name: string }>(sql`
      select table_schema || '.' || table_name as name
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema not in ('pg_catalog', 'information_schema', 'drizzle')
      order by 1`)
    const classified = [
      ...Object.keys(householdOwned).map((t) => `public.${t}`),
      ...Object.keys(notHouseholdOwned),
    ].sort()

    expect(result.rows.map((r) => r.name)).toEqual(classified)
  })

  dbTest.for(Object.entries(householdOwned))(
    '%s returns only the reading household rows',
    async ([, { seed, read }], { db }) => {
      const mine = (await createHousehold(db)).id
      const theirs = (await createHousehold(db)).id
      const mineIds = await seed(db, mine)
      const theirIds = await seed(db, theirs)

      expect(mineIds.length).toBeGreaterThan(0)
      expect((await read(db, mine)).sort()).toEqual([...mineIds].sort())
      expect((await read(db, theirs)).sort()).toEqual([...theirIds].sort())
    },
  )
})
