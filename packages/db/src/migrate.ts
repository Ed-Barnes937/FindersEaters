import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import * as schema from './schema/index.ts'

export const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))

/**
 * The session-level advisory lock every migrate takes, so two release steps
 * (or a release and a local run) never migrate at once. Any bigint works; this
 * one is "fe-migr" in ASCII (0x66652d6d696772). A string, because it is past
 * JavaScript's safe integer range; pass it as `$1::bigint`.
 */
export const MIGRATION_LOCK_ID = '28821693408044914'

export interface MigrateOptions {
  /** How long to wait for any lock, the advisory lock included. */
  lockTimeoutMs?: number
  /** The longest any one statement may run. */
  statementTimeoutMs?: number
}

/**
 * Applies every pending migration, in order, in one transaction, under the
 * migration advisory lock (docs/spec/operations.md section 3.1). The session
 * runs with `lock_timeout` 5s and `statement_timeout` 60s by default, so a
 * migration that would queue behind live traffic fails the release instead.
 * Use the direct (unpooled) URL: the lock belongs to the session.
 */
export async function migrateDatabase(url: string, options: MigrateOptions = {}): Promise<void> {
  const { lockTimeoutMs = 5_000, statementTimeoutMs = 60_000 } = options
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(`set lock_timeout = ${Math.trunc(lockTimeoutMs)}`)
    await client.query(`set statement_timeout = ${Math.trunc(statementTimeoutMs)}`)
    await client.query('select pg_advisory_lock($1::bigint)', [MIGRATION_LOCK_ID])
    await migrate(drizzle(client, { schema }), { migrationsFolder })
  } finally {
    // Ending the session releases the advisory lock.
    await client.end()
  }
}
