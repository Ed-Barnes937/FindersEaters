// The Better Auth instance (docs/spec/auth.md sections 2, 3 and 6): email and
// password only, no public sign-up, database sessions that slide over 90 days,
// and rate-limited sign-in. Nothing outside `auth/` touches Better Auth: the
// rest of the server sees a typed principal (./principal.ts), so swapping the
// library changes this folder only.
import { account, newId, session, user, verification, type Db } from '@finders-eaters/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

export interface AuthConfig {
  /** `BETTER_AUTH_SECRET`: signs the session cookie. */
  secret: string
  /** `BETTER_AUTH_URL`: the app's own origin, the only trusted origin. */
  baseURL: string
}

const DAY_SECONDS = 24 * 60 * 60

/** The request header the Fastify bridge sets to the client address it resolved. */
export const CLIENT_IP_HEADER = 'x-fe-client-ip'

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export function createAuth(db: Db, config: AuthConfig) {
  return betterAuth({
    secret: config.secret,
    baseURL: config.baseURL,
    basePath: '/api/auth',
    trustedOrigins: [new URL(config.baseURL).origin],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    session: {
      expiresIn: 90 * DAY_SECONDS,
      updateAge: DAY_SECONDS,
      // No cookie cache: every request reads the session row, so sign-out and
      // revocation are immediate (auth.md section 5).
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: 'memory',
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
      },
    },
    advanced: {
      database: { generateId: () => newId() },
      // The bridge overwrites this header with Fastify's resolved client
      // address, so a client cannot choose its own rate-limit bucket.
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
    },
    telemetry: { enabled: false },
  })
}

export type Auth = ReturnType<typeof createAuth>
