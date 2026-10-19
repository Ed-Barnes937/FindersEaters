// Ownership: households and users (docs/spec/data-model.md section 3).
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { createdAt, id, instant } from './columns.ts'

/** One value in V0.1; a new system is an added enum value (expand). */
export const unitsEnum = pgEnum('units', ['uk_metric'])

/** Owns every durable row, directly or through exactly one parent. */
export const household = pgTable('household', {
  id: id(),
  name: text('name').notNull(),
  defaultServings: integer('default_servings').notNull().default(2),
  /** IANA zone. "Today" for plans is computed in it. */
  timezone: text('timezone').notNull().default('Europe/London'),
  units: unitsEnum('units').notNull().default('uk_metric'),
  createdAt: createdAt(),
})

/**
 * A person who signs in. The shape is Better Auth's core `user` table
 * (docs/spec/auth.md section 2), so its Drizzle adapter reads and writes it as
 * is; property names are the adapter's field names.
 */
export const user = pgTable('user', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: instant('updated_at').notNull().defaultNow(),
})

/**
 * Who a row was created by: the signed-in user, or null for system writes.
 * Removing a user keeps their rows and nulls this (docs/spec/auth.md section 4).
 */
export const createdBy = () =>
  uuid('created_by').references(() => user.id, { onDelete: 'set null' })

/**
 * Joins users to households. The unique index on `user_id` is the V0.1 rule of
 * one household per user; dropping it is the only change if that ever lifts.
 */
export const householdUser = pgTable(
  'household_user',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.userId] }),
    unique('household_user_user_id_unique').on(t.userId),
  ],
)
