// Column conventions every table follows (docs/spec/data-model.md section 2).
import { timestamp, uuid } from 'drizzle-orm/pg-core'
import { v7 as uuidv7 } from 'uuid'

/** A new UUIDv7. The app mints ids; a client may supply its own on create. */
export function newId(): string {
  return uuidv7()
}

/**
 * The primary key. Defaulted by the app, not the database, so a client-supplied
 * id (a replayed offline mutation) is an idempotent `ON CONFLICT DO NOTHING`.
 */
export const id = () => uuid('id').primaryKey().$defaultFn(newId)

/** An instant. Times are always `timestamptz`. */
export const instant = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const createdAt = () => instant('created_at').notNull().defaultNow()
