// What the nightly backup reads from a database (docs/spec/operations.md
// section 5.2): row counts per durable table and the migration history.
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { connect } from './client.ts'
import { BACKUP_TABLES, migrationHistory, rowCounts, shippedMigrations } from './backup.ts'
import {
  addUser,
  createEmptyDatabase,
  createHousehold,
  dbTest,
  migrationCount,
} from './testing/index.ts'

describe('BACKUP_TABLES', () => {
  dbTest(
    'classifies every table the migrations create, so a new table forces a decision',
    async ({ db }) => {
      const result = await db.execute<{ name: string }>(sql`
      select table_schema || '.' || table_name as name
      from information_schema.tables
      where table_type = 'BASE TABLE'
        and table_schema not in ('pg_catalog', 'information_schema', 'drizzle')
      order by 1`)
      const classified = Object.keys(BACKUP_TABLES).sort()

      expect(result.rows.map((r) => r.name)).toEqual(classified)
    },
  )
})

describe('rowCounts', () => {
  dbTest('counts the rows of every durable table, and only those', async ({ db }) => {
    const before = await rowCounts(db)
    const home = await createHousehold(db)
    await addUser(db, home.id)
    await addUser(db, home.id)

    const after = await rowCounts(db)

    expect(after['public.household']).toBe(before['public.household']! + 1)
    expect(after['public.user']).toBe(before['public.user']! + 2)
    expect(after['public.household_user']).toBe(before['public.household_user']! + 2)
    expect(after).not.toHaveProperty('public.session')
    expect(after).not.toHaveProperty('public.verification')
  })
})

describe('migrationHistory', () => {
  dbTest(
    'of a fully migrated database is exactly the migrations this build ships',
    async ({ db }) => {
      const history = await migrationHistory(db)

      expect(history).toHaveLength(migrationCount())
      expect(history).toEqual(shippedMigrations())
    },
  )

  it('is empty for a database never migrated', async () => {
    const empty = await createEmptyDatabase('fe_backup')
    const { db, close } = connect(empty.url, { max: 1 })
    try {
      expect(await migrationHistory(db)).toEqual([])
    } finally {
      await close()
      await empty.drop()
    }
  })
})
