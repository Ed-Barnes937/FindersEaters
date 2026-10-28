import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import pg from 'pg'
import * as schema from './schema/index.ts'

/**
 * A database handle: the pool-backed client or a transaction inside it. Every
 * data-access function takes one, so callers choose the transaction boundary.
 */
export type Db = PgDatabase<NodePgQueryResultHKT, typeof schema>

export interface Database {
  db: NodePgDatabase<typeof schema>
  close: () => Promise<void>
}

export interface ConnectOptions {
  /** Pool size; default 10. */
  max?: number
  /** Give up on a new connection after this long; default no limit. */
  connectionTimeoutMillis?: number
}

export function connect(url: string, options: ConnectOptions = {}): Database {
  const pool = new pg.Pool({
    connectionString: url,
    max: options.max ?? 10,
    connectionTimeoutMillis: options.connectionTimeoutMillis,
    allowExitOnIdle: true,
  })
  return { db: drizzle(pool, { schema }), close: () => pool.end() }
}
