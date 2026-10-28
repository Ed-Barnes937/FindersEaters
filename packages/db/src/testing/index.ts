// Database test helpers for any workspace. Add the global setup to the
// workspace's vitest.config.ts, then write tests with `dbTest`:
//
//   test: { globalSetup: ['@finders-eaters/db/testing/global-setup'] }
import './provided-context.ts'

export { dbTest } from './db-test.ts'
export { addUser, createHousehold } from './fixtures.ts'
export { createEmptyDatabase, type EmptyDatabase } from './empty-database.ts'
export { migrationCount } from './migration-count.ts'
