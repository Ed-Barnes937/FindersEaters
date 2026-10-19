import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { connect } from './client.ts'

export const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))

/** Applies every pending migration, in order, in one transaction. */
export async function migrateDatabase(url: string): Promise<void> {
  const { db, close } = connect(url, { max: 1 })
  try {
    await migrate(db, { migrationsFolder })
  } finally {
    await close()
  }
}
