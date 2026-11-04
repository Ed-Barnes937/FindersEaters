// The nightly backup's restore-verify (docs/spec/operations.md section 5.2,
// step 3), against real databases: a "source" standing in for production and a
// "restored" one standing in for the dump restored into the throwaway pg17
// container. How the restored rows got there (pg_restore) is the shell's job and
// is covered by scripts/backup/e2e.sh.
import { connect, migrateDatabase, shippedMigrations, sql, type Db } from '@finders-eaters/db'
import {
  addUser,
  createEmptyDatabase,
  createHousehold,
  migrationCount,
  type EmptyDatabase,
} from '@finders-eaters/db/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { BackupVerificationError, verifyRestore, type BackupManifest } from './verify.ts'

let source: EmptyDatabase
let restored: EmptyDatabase

beforeEach(async () => {
  source = await createEmptyDatabase('fe_backup_src')
  restored = await createEmptyDatabase('fe_backup_dst')
  await migrateDatabase(source.url)
  await migrateDatabase(restored.url)
})

afterEach(async () => {
  await source.drop()
  await restored.drop()
})

async function on<T>(url: string, work: (db: Db) => Promise<T>): Promise<T> {
  const { db, close } = connect(url, { max: 1 })
  try {
    return await work(db)
  } finally {
    await close()
  }
}

async function seed(url: string, households: number): Promise<void> {
  await on(url, async (db) => {
    for (let i = 0; i < households; i++) {
      const home = await createHousehold(db)
      await addUser(db, home.id)
    }
  })
}

const dump = { date: '2026-10-28', objectKey: 'daily/2026-10-28.dump', sizeBytes: 4321 }
const now = () => new Date('2026-10-28T03:17:00Z')

function verify(previous: BackupManifest | null = null, logs: string[] = []) {
  return verifyRestore({
    restoredUrl: restored.url,
    sourceUrl: source.url,
    previous,
    dump,
    now,
    log: (line) => logs.push(line),
  })
}

async function failures(promise: Promise<unknown>): Promise<string[]> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(BackupVerificationError)
  return (error as BackupVerificationError).failures
}

describe('verifyRestore', () => {
  it('passes a good restore and returns the manifest that will become latest.json', async () => {
    await seed(source.url, 1)
    await seed(restored.url, 1)
    const logs: string[] = []

    const manifest = await verify(null, logs)

    expect(manifest).toEqual({
      date: '2026-10-28',
      createdAt: '2026-10-28T03:17:00.000Z',
      objectKey: 'daily/2026-10-28.dump',
      sizeBytes: 4321,
      rowCounts: {
        'public.household': 1,
        'public.user': 1,
        'public.household_user': 1,
        'public.account': 0,
      },
      migrations: { applied: migrationCount(), head: shippedMigrations().at(-1)!.hash },
      kbVersion: null,
    })
    expect(logs).toContain('release: done')
    expect(logs.at(-1)).toBe('verify: passed')
  })

  it('fails a restore with no household: an empty or wrong database is not a backup', async () => {
    expect(await failures(verify())).toEqual([
      'public.household has 0 rows; a production backup has at least one household',
    ])
  })

  it('fails when a never-shrinking table has fewer rows than the previous backup', async () => {
    await seed(source.url, 2)
    await seed(restored.url, 2)
    const previous = await verify()
    await on(restored.url, (db) =>
      db.execute(sql`delete from household where id in (select id from household limit 1)`),
    )

    expect(await failures(verify(previous))).toEqual([
      'public.household has 1 row, fewer than the 2 in the previous backup (daily/2026-10-28.dump); the dump is truncated or from the wrong database',
    ])
  })

  it('allows a counted table to shrink, such as a removed user', async () => {
    await seed(source.url, 1)
    await seed(restored.url, 1)
    const previous = await verify()
    await on(restored.url, (db) => db.execute(sql`delete from "user"`))

    await expect(verify(previous)).resolves.toMatchObject({
      rowCounts: { 'public.user': 0, 'public.household': 1 },
    })
  })

  it('fails when the restored migration history differs from the source database', async () => {
    await seed(source.url, 1)
    await seed(restored.url, 1)
    await on(restored.url, (db) =>
      db.execute(
        sql`delete from drizzle.__drizzle_migrations where created_at = (select max(created_at) from drizzle.__drizzle_migrations)`,
      ),
    )

    const found = await failures(verify())
    expect(found[0]).toMatch(
      new RegExp(
        `^migration history: the restore has ${migrationCount() - 1} migrations, the source has ${migrationCount()}`,
      ),
    )
  })

  it('fails when the history has a migration this build does not ship', async () => {
    await seed(source.url, 1)
    await seed(restored.url, 1)
    for (const url of [source.url, restored.url]) {
      await on(url, (db) =>
        db.execute(
          sql`insert into drizzle.__drizzle_migrations (hash, created_at) values ('${sql.raw('f'.repeat(64))}', 99999999999999)`,
        ),
      )
    }

    expect(await failures(verify())).toEqual([
      `migration history: migration ${migrationCount() + 1} (${'f'.repeat(12)}) is not one this build ships; the database is ahead of or diverged from main`,
    ])
  })

  it('fails when the release step cannot run against the restore', async () => {
    await seed(source.url, 1)
    await seed(restored.url, 1)
    // A history that claims fewer migrations than the schema has: the release
    // step re-runs the last one, which collides with the tables already there.
    for (const url of [source.url, restored.url]) {
      await on(url, (db) =>
        db.execute(
          sql`delete from drizzle.__drizzle_migrations where created_at = (select max(created_at) from drizzle.__drizzle_migrations)`,
        ),
      )
    }

    const found = await failures(verify())
    expect(found).toHaveLength(1)
    expect(found[0]).toMatch(/^release step: release failed at migrate: /)
  })
})
