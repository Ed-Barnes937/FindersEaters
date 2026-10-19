// Test fixtures: rows written straight through the schema, with unique values
// so concurrent test transactions never contend on a unique index.
import type { Db } from '../client.ts'
import { newId } from '../schema/columns.ts'
import { household, householdUser, user } from '../schema/index.ts'

export async function createHousehold(db: Db, values: Partial<typeof household.$inferInsert> = {}) {
  const [row] = await db
    .insert(household)
    .values({ name: 'Test household', ...values })
    .returning()
  return row!
}

/** Creates a user and makes them a member of the household. */
export async function addUser(
  db: Db,
  householdId: string,
  values: Partial<typeof user.$inferInsert> = {},
) {
  const id = values.id ?? newId()
  const [row] = await db
    .insert(user)
    .values({ name: 'Test user', email: `${id}@example.test`, ...values, id })
    .returning()
  await db.insert(householdUser).values({ householdId, userId: id })
  return row!
}
