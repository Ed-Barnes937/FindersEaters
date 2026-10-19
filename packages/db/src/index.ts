// The database: Drizzle schema, migrations and household-scoped data access
// (docs/spec/data-model.md). Test helpers live in `@finders-eaters/db/testing`.
export * from './schema/index.ts'
export { createdAt, id, instant, newId } from './schema/columns.ts'
export { connect, type Database, type Db } from './client.ts'
export { migrateDatabase, migrationsFolder } from './migrate.ts'
export { ownedBy } from './access/scope.ts'
export { getHousehold, listHouseholdUsers, type Household, type User } from './access/household.ts'
