import { sql } from 'drizzle-orm'
import type { Db } from './client.ts'

export type DatabaseHealth =
  { ok: true; latencyMs: number; migrationsApplied: number } | { ok: false; error: string }

/**
 * A deep round-trip for `/health` (docs/spec/operations.md section 3): one
 * query that needs a live connection and a migrated database, reporting how
 * many migrations are applied so a smoke test can see the schema is current.
 * The error is a short code (a Postgres SQLSTATE or a Node errno), never the
 * driver's message, because `/health` is public.
 */
export async function checkDatabase(db: Db): Promise<DatabaseHealth> {
  const started = performance.now()
  try {
    const result = await db.execute<{ applied: number }>(
      sql`select count(*)::int as applied from drizzle.__drizzle_migrations`,
    )
    return {
      ok: true,
      latencyMs: Math.round(performance.now() - started),
      migrationsApplied: result.rows[0]!.applied,
    }
  } catch (error) {
    return { ok: false, error: errorCode(error) }
  }
}

function errorCode(error: unknown): string {
  // Drizzle wraps driver errors; the code lives on the error or its cause.
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    if ('code' in e && typeof e.code === 'string') return e.code
  }
  return 'unavailable'
}
