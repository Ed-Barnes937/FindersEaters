// The nightly backup's restore-verify (docs/spec/operations.md section 5.2,
// step 3). The dump has already been restored with `pg_restore --exit-on-error`
// into a throwaway pg17 database; this checks the restore is a real, complete,
// usable copy of production:
//
//   1. at least one household, and no never-shrinking table below the previous
//      backup's count (a smaller number means a truncated or wrong dump);
//   2. the restored migration history equals the source database's, and is a
//      prefix of the migrations this build ships;
//   3. this build's release step runs cleanly against it (a restore is usable
//      by today's code);
//   4. a deep read: the `/health` query reports every shipped migration.
//
// Every failure is collected and reported together, and any failure throws, so
// the job fails and the manifest is not advanced.
import {
  BACKUP_TABLES,
  checkDatabase,
  connect,
  migrationHistory,
  rowCounts,
  shippedMigrations,
  type AppliedMigration,
  type Db,
  type RowCounts,
} from '@finders-eaters/db'

import { release } from '../release.ts'

/** `manifest/latest.json`: the last verified backup. */
export interface BackupManifest {
  /** The UTC date the backup was taken, `YYYY-MM-DD`. */
  date: string
  /** When verification passed, ISO 8601. The staging refresh's freshness check reads it. */
  createdAt: string
  /** The dump's key in the bucket, `daily/<date>.dump`. */
  objectKey: string
  sizeBytes: number
  /** Rows per durable table, as restored (before the release step). */
  rowCounts: RowCounts
  /** The dump's migration history: how many, and the last one's hash. */
  migrations: { applied: number; head: string | null }
  /** The loaded knowledge base version (`ops.meta`); null until the KB load lands. */
  kbVersion: string | null
}

export interface VerifyRestoreInput {
  /** The throwaway database the dump was restored into. The release step migrates it. */
  restoredUrl: string
  /** The database that was dumped (production, as the read-only `backup` role). Read only. */
  sourceUrl: string
  /** The previous verified manifest, or null on the first backup. */
  previous: BackupManifest | null
  dump: { date: string; objectKey: string; sizeBytes: number }
  now?: () => Date
  log: (line: string) => void
}

export class BackupVerificationError extends Error {
  readonly failures: string[]

  constructor(failures: string[]) {
    super(`backup verification failed:\n${failures.map((f) => `  - ${f}`).join('\n')}`)
    this.name = 'BackupVerificationError'
    this.failures = failures
  }
}

export async function verifyRestore(input: VerifyRestoreInput): Promise<BackupManifest> {
  const { restoredUrl, sourceUrl, previous, dump, log, now = () => new Date() } = input

  const restoredState = await withDb(restoredUrl, async (db) => ({
    counts: await rowCounts(db),
    history: await migrationHistory(db),
  }))
  const sourceHistory = await withDb(sourceUrl, migrationHistory)
  log(`verify: restored ${describeCounts(restoredState.counts)}`)

  const failures = [
    ...checkCounts(restoredState.counts, previous),
    ...checkHistory(restoredState.history, sourceHistory, shippedMigrations()),
  ]
  if (failures.length > 0) throw new BackupVerificationError(failures)
  log(`verify: row counts and migration history (${restoredState.history.length}) match`)

  try {
    await release(restoredUrl, log)
  } catch (error) {
    throw new BackupVerificationError([`release step: ${messageOf(error)}`])
  }

  const health = await withDb(restoredUrl, checkDatabase)
  const shipped = shippedMigrations().length
  if (!health.ok) {
    throw new BackupVerificationError([`deep read: the /health query failed (${health.error})`])
  }
  if (health.migrationsApplied !== shipped) {
    throw new BackupVerificationError([
      `deep read: /health reports ${health.migrationsApplied} migrations after the release step, this build ships ${shipped}`,
    ])
  }
  // The recipe ticket adds the second half of the deep read here: one
  // recipe's engine output parsed with its zod schema (section 5.2, step 3).
  log('verify: passed')

  return {
    date: dump.date,
    createdAt: now().toISOString(),
    objectKey: dump.objectKey,
    sizeBytes: dump.sizeBytes,
    rowCounts: restoredState.counts,
    migrations: {
      applied: restoredState.history.length,
      head: restoredState.history.at(-1)?.hash ?? null,
    },
    kbVersion: null,
  }
}

function checkCounts(counts: RowCounts, previous: BackupManifest | null): string[] {
  const failures: string[] = []
  if ((counts['public.household'] ?? 0) < 1) {
    failures.push(
      `public.household has ${counts['public.household'] ?? 0} rows; a production backup has at least one household`,
    )
  }
  if (!previous) return failures
  for (const [table, kind] of Object.entries(BACKUP_TABLES)) {
    if (kind !== 'never-shrinks') continue
    const now = counts[table] ?? 0
    const before = previous.rowCounts[table]
    if (before !== undefined && now < before) {
      failures.push(
        `${table} has ${plural(now, 'row')}, fewer than the ${before} in the previous backup (${previous.objectKey}); the dump is truncated or from the wrong database`,
      )
    }
  }
  return failures
}

function checkHistory(
  restored: AppliedMigration[],
  source: AppliedMigration[],
  shipped: AppliedMigration[],
): string[] {
  if (!sameHistory(restored, source)) {
    return [
      `migration history: the restore has ${restored.length} migrations, the source has ${source.length}, and they differ (restore head ${short(restored.at(-1))}, source head ${short(source.at(-1))})`,
    ]
  }
  for (const [i, applied] of restored.entries()) {
    const ours = shipped[i]
    if (!ours || ours.hash !== applied.hash || ours.createdAt !== applied.createdAt) {
      return [
        `migration history: migration ${i + 1} (${short(applied)}) is not one this build ships; the database is ahead of or diverged from main`,
      ]
    }
  }
  return []
}

function sameHistory(a: AppliedMigration[], b: AppliedMigration[]): boolean {
  return (
    a.length === b.length &&
    a.every((m, i) => m.hash === b[i]!.hash && m.createdAt === b[i]!.createdAt)
  )
}

function short(m: AppliedMigration | undefined): string {
  return m ? m.hash.slice(0, 12) : 'none'
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function describeCounts(counts: RowCounts): string {
  return Object.entries(counts)
    .map(([table, n]) => `${table}=${n}`)
    .join(' ')
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function withDb<T>(url: string, work: (db: Db) => Promise<T>): Promise<T> {
  const { db, close } = connect(url, { max: 1 })
  try {
    return await work(db)
  } finally {
    await close()
  }
}
