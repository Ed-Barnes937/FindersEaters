// Better Auth's own tables (docs/spec/auth.md section 2): sessions, credentials
// and verification values. They live in the app's single schema and migration
// journal, are generated with the rest, and use the app's UUIDv7 ids. Shapes
// are Better Auth's core schema; property names are its Drizzle adapter's field
// names. None is household-owned: each is reached through `user`.
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, id, instant } from './columns.ts'
import { user } from './ownership.ts'

const updatedAt = () => instant('updated_at').notNull().defaultNow()

/** A signed-in device. Database-backed, so deleting a row signs it out at once. */
export const session = pgTable(
  'session',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: instant('expires_at').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
)

/**
 * How a user signs in. V0.1 has only the `credential` provider, whose row holds
 * the password hash (Better Auth's scrypt format).
 */
export const account = pgTable(
  'account',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: instant('access_token_expires_at'),
    refreshTokenExpiresAt: instant('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
)

/** Short-lived values Better Auth issues and checks (no V0.1 flow uses them). */
export const verification = pgTable(
  'verification',
  {
    id: id(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: instant('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)
