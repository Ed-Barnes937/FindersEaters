// Database test helpers for any workspace. Add the global setup to the
// workspace's vitest.config.ts, then write tests with `dbTest`:
//
//   test: { globalSetup: ['@finders-eaters/db/testing/global-setup'] }
export { dbTest } from './db-test.ts'
export { addUser, createHousehold } from './fixtures.ts'
