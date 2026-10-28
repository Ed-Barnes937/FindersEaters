// Vitest global setup for database tests (docs/spec/v0.1.md section 17.2).
// One Postgres container serves the run (the CI service container, or Docker
// Compose locally). Each run creates its own empty database in it, applies the
// migrations once and drops it afterwards, so concurrent runs never collide.
//
// Use it from a workspace's vitest.config.ts:
//   test: { globalSetup: ['@finders-eaters/db/testing/global-setup'] }
import type { TestProject } from 'vitest/node'
import { migrateDatabase } from '../migrate.ts'
import { createEmptyDatabase } from './empty-database.ts'
import './provided-context.ts'

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const database = await createEmptyDatabase()
  await migrateDatabase(database.url)
  project.provide('databaseUrl', database.url)
  return database.drop
}
