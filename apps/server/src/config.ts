// Environment for the server and the admin CLI. Fails fast, naming every
// missing variable, rather than starting half-configured.
import type { AuthConfig } from './auth/auth.ts'

export interface Config {
  databaseUrl: string
  auth: AuthConfig
}

const REQUIRED = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'] as const

export function readConfig(env: Record<string, string | undefined>): Config {
  const missing = REQUIRED.filter((name) => !env[name])
  if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(', ')}`)
  const secret = env.BETTER_AUTH_SECRET!
  const baseURL = env.BETTER_AUTH_URL!
  if (secret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters')
  if (!/^https?:\/\/[^/]+/.test(baseURL)) {
    throw new Error('BETTER_AUTH_URL must be an http or https URL')
  }
  return { databaseUrl: env.DATABASE_URL!, auth: { secret, baseURL } }
}
