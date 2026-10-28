// How many migrations the package ships, from Drizzle's journal: what a fully
// migrated database's `/health` reports, so tests need no edit per migration.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { migrationsFolder } from '../migrate.ts'

export function migrationCount(): number {
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: unknown[] }
  return journal.entries.length
}
