// Household-scoped data access. Every function takes the household id from the
// request's principal, never from input (docs/spec/auth.md section 5).
import { eq, getTableColumns } from 'drizzle-orm'
import type { Db } from '../client.ts'
import { household, householdUser, user } from '../schema/index.ts'
import { ownedBy } from './scope.ts'

export type Household = typeof household.$inferSelect
export type User = typeof user.$inferSelect

export async function getHousehold(db: Db, householdId: string): Promise<Household | undefined> {
  const [row] = await db.select().from(household).where(eq(household.id, householdId))
  return row
}

/** The household's members, oldest first. */
export function listHouseholdUsers(db: Db, householdId: string): Promise<User[]> {
  return db
    .select(getTableColumns(user))
    .from(householdUser)
    .innerJoin(user, eq(user.id, householdUser.userId))
    .where(ownedBy(householdUser, householdId))
    .orderBy(householdUser.createdAt, user.id)
}
