// A throwaway, empty database on the test Postgres server (the CI service
// container, or Docker Compose locally): for the run's migrated database and
// for tests that must start from nothing, such as the release step's.
import { randomBytes } from 'node:crypto'
import pg from 'pg'

export const defaultServerUrl = 'postgres://postgres:postgres@localhost:5432/finders_eaters'

export interface EmptyDatabase {
  url: string
  drop: () => Promise<void>
}

export async function createEmptyDatabase(prefix = 'fe_test'): Promise<EmptyDatabase> {
  const serverUrl = process.env.DATABASE_URL ?? defaultServerUrl
  const name = `${prefix}_${randomBytes(6).toString('hex')}`

  await onServer(serverUrl, `create database ${name}`)
  const url = new URL(serverUrl)
  url.pathname = `/${name}`
  return {
    url: url.toString(),
    drop: () => onServer(serverUrl, `drop database if exists ${name} with (force)`),
  }
}

async function onServer(url: string, statement: string): Promise<void> {
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
    await client.query(statement)
  } finally {
    await client.end()
  }
}

function redact(url: string): string {
  const parsed = new URL(url)
  if (parsed.password) parsed.password = '***'
  return parsed.toString()
}
