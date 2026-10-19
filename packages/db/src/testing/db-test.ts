// `dbTest` is Vitest's `test` with a `db` fixture: a transaction on the run's
// migrated database that is rolled back when the test ends, so tests never see
// each other's rows and need no cleanup. Needs the global setup in
// ./global-setup.ts.
import { TransactionRollbackError } from 'drizzle-orm'
import { inject, test } from 'vitest'
import { connect, type Database, type Db } from '../client.ts'
import './provided-context.ts'

let database: Database | undefined

function shared(): Database {
  database ??= connect(inject('databaseUrl'))
  return database
}

export const dbTest = test.extend<{ db: Db }>({
  // Vitest reads fixture dependencies from the destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  db: async ({}, use) => {
    try {
      await shared().db.transaction(async (tx) => {
        await use(tx)
        tx.rollback()
      })
    } catch (error) {
      if (!(error instanceof TransactionRollbackError)) throw error
    }
  },
})
