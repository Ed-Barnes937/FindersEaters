// The release step's migrate (docs/spec/operations.md section 3.1), against
// throwaway databases of its own so it starts from empty.
import pg from 'pg'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { connect } from './client.ts'
import { checkDatabase } from './health.ts'
import { MIGRATION_LOCK_ID, migrateDatabase } from './migrate.ts'
import { createEmptyDatabase, type EmptyDatabase } from './testing/empty-database.ts'
import { migrationCount } from './testing/migration-count.ts'

let database: EmptyDatabase

beforeEach(async () => {
  database = await createEmptyDatabase('fe_migrate')
})

afterEach(async () => {
  await database.drop()
})

describe('migrateDatabase', () => {
  it('applies every migration to an empty database, and a rerun changes nothing', async () => {
    await migrateDatabase(database.url)
    expect(await migrationsApplied()).toBe(migrationCount())

    await migrateDatabase(database.url)
    expect(await migrationsApplied()).toBe(migrationCount())
  })

  it('fails on the lock timeout rather than queueing behind another holder of the lock', async () => {
    const holder = new pg.Client({ connectionString: database.url })
    await holder.connect()
    try {
      await holder.query('select pg_advisory_lock($1::bigint)', [MIGRATION_LOCK_ID])

      const started = Date.now()
      await expect(migrateDatabase(database.url, { lockTimeoutMs: 200 })).rejects.toMatchObject({
        code: '55P03', // lock_not_available
      })
      expect(Date.now() - started).toBeLessThan(5_000)
      expect(await migrationsApplied()).toBeNull()
    } finally {
      await holder.end()
    }

    // Once the holder is gone the same call goes through.
    await migrateDatabase(database.url, { lockTimeoutMs: 200 })
    expect(await migrationsApplied()).toBe(migrationCount())
  })
})

/** The count `/health` reports, or null when nothing has been migrated. */
async function migrationsApplied(): Promise<number | null> {
  const { db, close } = connect(database.url, { max: 1 })
  try {
    const health = await checkDatabase(db)
    return health.ok ? health.migrationsApplied : null
  } finally {
    await close()
  }
}
