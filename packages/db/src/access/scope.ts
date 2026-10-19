// The household-scope rule for data access (docs/spec/data-model.md section 2).
// Every durable row carries `household_id` directly or through exactly one
// parent. A read of a table with the column filters with `ownedBy`; a read of a
// child table joins its parent and filters the parent with `ownedBy`. The
// household-scope test (src/household-scope.test.ts) checks every table.
import { eq, type SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

export function ownedBy(table: PgTable & { householdId: PgColumn }, householdId: string): SQL {
  return eq(table.householdId, householdId)
}
