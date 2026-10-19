// Vitest global setup for database tests (docs/spec/v0.1.md section 17.2).
// One Postgres container serves the run (the CI service container, or Docker
// Compose locally). Each run creates its own empty database in it, applies the
// migrations once and drops it afterwards, so concurrent runs never collide.
//
// Use it from a workspace's vitest.config.ts:
//   test: { globalSetup: ['@finders-eaters/db/testing/global-setup'] }
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import type { TestProject } from 'vitest/node'
import { migrateDatabase } from '../migrate.ts'

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

export const defaultServerUrl = 'postgres://postgres:postgres@localhost:5432/finders_eaters'

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const serverUrl = process.env.DATABASE_URL ?? defaultServerUrl
  const name = `fe_test_${randomBytes(6).toString('hex')}`

  await withServer(serverUrl, (client) => client.query(`create database ${name}`))
  const url = new URL(serverUrl)
  url.pathname = `/${name}`
  await migrateDatabase(url.toString())
  project.provide('databaseUrl', url.toString())

  return async () => {
    await withServer(serverUrl, (client) =>
      client.query(`drop database if exists ${name} with (force)`),
    )
  }
}

async function withServer(
  url: string,
  run: (client: pg.Client) => Promise<unknown>,
): Promise<void> {
  const client = new pg.Client({ connectionString: url })
  try {
    await client.connect()
  } catch (cause) {
    throw new Error(
      `Database tests need Postgres at ${redact(url)}. Start it with \`docker compose up -d --wait\` ` +
        'from the repo root, or set DATABASE_URL.',
      { cause },
    )
  }
  try {
    await run(client)
  } finally {
    await client.end()
  }
}

function redact(url: string): string {
  const parsed = new URL(url)
  if (parsed.password) parsed.password = '***'
  return parsed.toString()
}
