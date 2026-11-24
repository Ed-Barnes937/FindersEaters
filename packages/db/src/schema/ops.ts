// Operational state (docs/spec/operations.md section 3.1): small key/value
// facts about the deployment, such as the loaded KB version.
import { pgSchema, text } from 'drizzle-orm/pg-core'
import { instant } from './columns.ts'

export const ops = pgSchema('ops')

export const meta = ops.table('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
})

/** The `ops.meta` key holding the loaded KB version. */
export const KB_VERSION_KEY = 'kb_version'
