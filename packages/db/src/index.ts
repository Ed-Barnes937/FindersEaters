// The database: Drizzle schema, migrations and household-scoped data access
// (docs/spec/data-model.md). Test helpers live in `@finders-eaters/db/testing`.
export * from './schema/index.ts'
// The query operators callers need, from the one drizzle-orm this package pins.
export { and, eq, sql } from 'drizzle-orm'
export { createdAt, id, instant, newId } from './schema/columns.ts'
export { connect, type Database, type Db } from './client.ts'
export {
  MIGRATION_LOCK_ID,
  migrateDatabase,
  migrationsFolder,
  type MigrateOptions,
} from './migrate.ts'
export { checkDatabase, type DatabaseHealth } from './health.ts'
export { ownedBy } from './access/scope.ts'
export {
  getHousehold,
  getHouseholdMember,
  householdIdOfUser,
  listHouseholdUsers,
  type Household,
  type User,
} from './access/household.ts'
export {
  BACKUP_TABLES,
  migrationHistory,
  rowCounts,
  shippedMigrations,
  type AppliedMigration,
  type BackupTable,
  type RowCounts,
} from './backup.ts'
