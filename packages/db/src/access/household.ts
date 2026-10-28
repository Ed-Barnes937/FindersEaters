// Household-scoped data access. Every function takes the household id from the
// request's principal, never from input (docs/spec/auth.md section 5).
import { and, eq, getTableColumns } from 'drizzle-orm'
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

/** One member of the household, or undefined if the user is not in it. */
export async function getHouseholdMember(
  db: Db,
  householdId: string,
  userId: string,
): Promise<User | undefined> {
  const [row] = await db
    .select(getTableColumns(user))
    .from(householdUser)
    .innerJoin(user, eq(user.id, householdUser.userId))
    .where(and(ownedBy(householdUser, householdId), eq(householdUser.userId, userId)))
  return row
}

/**
 * The household a signed-in user belongs to: the one lookup that turns a
 * session into a principal. Undefined only for a user a half-run CLI left
 * without a household.
 */
export async function householdIdOfUser(db: Db, userId: string): Promise<string | undefined> {
  const [row] = await db
    .select({ householdId: householdUser.householdId })
    .from(householdUser)
    .where(eq(householdUser.userId, userId))
  return row?.householdId
}
