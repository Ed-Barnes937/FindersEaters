// What the nightly backup reads from a database (docs/spec/operations.md
// section 5.2): row counts per durable table and the migration history. The
// restore-verify compares both against the previous manifest, the source
// database and the migrations this build ships.
import { sql } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'

import type { Db } from './client.ts'
import { migrationsFolder } from './migrate.ts'

/**
 * How the backup treats each table, by `schema.table`. Every table the
 * migrations create must be listed (a test enforces it), so a new table is a
 * deliberate choice:
 *
 * - `never-shrinks`: durable, and its count must never fall from one backup to
 *   the next (nothing deletes these rows, or deletes are soft), so a smaller
 *   count means a truncated or wrong dump.
 * - `counted`: durable; counted in the manifest, but rows may be removed.
 * - `not-durable`: dumped like everything else, but not counted (sessions and
 *   sign-in tokens come and go).
 */
export const BACKUP_TABLES = {
  // The admin CLI has no household delete (docs/spec/auth.md section 4).
  'public.household': 'never-shrinks',
  'public.user': 'counted',
  'public.household_user': 'counted',
  'public.account': 'counted',
  'public.session': 'not-durable',
  'public.verification': 'not-durable',
} as const satisfies Record<string, 'never-shrinks' | 'counted' | 'not-durable'>

export type BackupTable = keyof typeof BACKUP_TABLES

export type RowCounts = Record<string, number>

/** One applied migration, as Drizzle records it in `drizzle.__drizzle_migrations`. */
export interface AppliedMigration {
  /** SHA-256 of the migration's SQL file. */
  hash: string
  /** The migration's journal timestamp (ms), which orders the history. */
  createdAt: number
}

/** Rows per durable table, keyed `schema.table`. */
export async function rowCounts(db: Db): Promise<RowCounts> {
  const durable = Object.entries(BACKUP_TABLES).filter(([, kind]) => kind !== 'not-durable')
  const counts: RowCounts = {}
  for (const [name] of durable) {
    const [schema, table] = name.split('.') as [string, string]
    const result = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(schema)}.${sql.identifier(table)}`,
    )
    counts[name] = result.rows[0]!.n
  }
  return counts
}

/** The applied migrations in order, or none when the database was never migrated. */
export async function migrationHistory(db: Db): Promise<AppliedMigration[]> {
  const exists = await db.execute<{ found: boolean }>(
    sql`select to_regclass('drizzle.__drizzle_migrations') is not null as found`,
  )
  if (!exists.rows[0]!.found) return []
  const result = await db.execute<{ hash: string; created_at: string }>(
    sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at, id`,
  )
  return result.rows.map((row) => ({ hash: row.hash, createdAt: Number(row.created_at) }))
}

/** The migrations this build ships, in order: what a fully migrated database's history equals. */
export function shippedMigrations(): AppliedMigration[] {
  return readMigrationFiles({ migrationsFolder }).map((m) => ({
    hash: m.hash,
    createdAt: m.folderMillis,
  }))
}
