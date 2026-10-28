// The SQL the wizard runs for the read-only `backup` role, against the test
// Postgres (the CI service container, or Docker Compose locally). The wizard
// itself is rehearsed against a fake psql; this proves the SQL does what the
// fake pretends.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createEmptyDatabase, type EmptyDatabase } from '@finders-eaters/db/testing'

import { scriptsDir } from './drive.ts'

const createRole = readFileSync(join(scriptsDir, 'provision/backup-role.sql'), 'utf8')
const check = readFileSync(join(scriptsDir, 'provision/backup-role-check.sql'), 'utf8')
const password = 'a1b2c3d4'.repeat(8)

async function as<T>(url: string, work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return await work(client)
  } finally {
    await client.end()
  }
}

function asBackup(url: string): string {
  const parsed = new URL(url)
  parsed.username = 'backup'
  parsed.password = password
  return parsed.toString()
}

describe('backup-role.sql', () => {
  let database: EmptyDatabase

  beforeAll(async () => {
    database = await createEmptyDatabase('fe_backup_role')
    await as(database.url, async (owner) => {
      await owner.query('create schema kb')
      await owner.query('create table public.recipe (id int primary key)')
      await owner.query('create table kb.food (id int primary key)')
      await owner.query('insert into public.recipe values (1)')
      await owner.query('insert into kb.food values (7)')
    })
  })

  afterAll(async () => {
    await database.drop()
    await as(database.url.replace(/\/[^/?]+(\?|$)/, '/postgres$1'), (owner) =>
      owner.query('drop role if exists backup'),
    )
  })

  it('makes a role that reads every schema, writes nothing, and passes the wizard check; rerunning is safe', async () => {
    const sql = createRole.replaceAll('__PASSWORD__', password)
    await as(database.url, (owner) => owner.query(sql))
    await as(database.url, (owner) => owner.query(sql))

    await as(asBackup(database.url), async (backup) => {
      expect((await backup.query(check)).rows[0]).toEqual({ '?column?': true })
      expect((await backup.query('select id from public.recipe')).rows).toEqual([{ id: 1 }])
      expect((await backup.query('select id from kb.food')).rows).toEqual([{ id: 7 }])
      await expect(backup.query('insert into public.recipe values (2)')).rejects.toThrow(
        /permission denied/,
      )
      await expect(backup.query('create table public.sneaky (id int)')).rejects.toThrow(
        /permission denied/,
      )
    })
  })

  it('the check fails for a role that can write', async () => {
    await as(database.url, async (owner) => {
      const ok = await owner.query<{ '?column?': boolean }>(check)
      expect(ok.rows[0]?.['?column?']).toBe(false)
    })
  })
})
