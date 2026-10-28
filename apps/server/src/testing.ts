// Test support for the server: `serverTest` is the database package's `dbTest`
// plus a built server and the admin CLI, both on the test's rolled-back
// transaction, so a test can create accounts with the CLI and then drive the
// HTTP API exactly as a browser would.
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { dbTest } from '@finders-eaters/db/testing'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'

import { buildServer } from './app.ts'
import type { AuthConfig } from './auth/auth.ts'
import { runCli } from './cli/run.ts'

export const INDEX_HTML = '<!doctype html><title>Finders Eaters</title><div id="root"></div>'

export const testAuthConfig: AuthConfig = {
  secret: 'test-only-secret-that-is-long-enough-for-better-auth',
  baseURL: 'http://localhost:4173',
}

export interface CliResult {
  code: number
  stdout: string
  stderr: string
}

export type Cli = (argv: string[]) => Promise<CliResult>

export const serverTest = dbTest.extend<{
  auth: AuthConfig
  server: FastifyInstance
  cli: Cli
}>({
  auth: testAuthConfig,
  server: async ({ db, auth }, use) => {
    const staticDir = await mkdtemp(join(tmpdir(), 'fe-static-'))
    await writeFile(join(staticDir, 'index.html'), INDEX_HTML)
    await writeFile(join(staticDir, 'app.js'), 'console.log("app")')
    const server = await buildServer({ staticDir, db, auth })
    await use(server)
    await server.close()
    await rm(staticDir, { recursive: true, force: true })
  },
  cli: async ({ db, auth }, use) => {
    await use(async (argv) => {
      let stdout = ''
      let stderr = ''
      const code = await runCli(argv, {
        db,
        auth,
        out: (text) => (stdout += `${text}\n`),
        err: (text) => (stderr += `${text}\n`),
      })
      return { code, stdout, stderr }
    })
  },
})

/** A unique email, so concurrent test transactions never contend on the index. */
export function uniqueEmail(name = 'person'): string {
  return `${name}-${randomUUID()}@example.test`
}

/** The generated password a CLI command printed once. */
export function printedPassword(result: CliResult): string {
  const match = /password \(shown once\): (\S+)/.exec(result.stdout)
  if (!match?.[1]) throw new Error(`no password in CLI output:\n${result.stdout}${result.stderr}`)
  return match[1]
}

/** A distinct client address per call, so rate limits never leak between tests. */
export function clientAddress(): string {
  const n = randomUUID().replace(/-/g, '')
  return `10.${parseInt(n.slice(0, 2), 16)}.${parseInt(n.slice(2, 4), 16)}.${parseInt(n.slice(4, 6), 16)}`
}

export interface SignInOptions {
  remoteAddress?: string
}

export function signIn(
  server: FastifyInstance,
  email: string,
  password: string,
  options: SignInOptions = {},
): Promise<LightMyRequestResponse> {
  return server.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    headers: { origin: testAuthConfig.baseURL, 'content-type': 'application/json' },
    payload: { email, password },
    remoteAddress: options.remoteAddress ?? clientAddress(),
  })
}

/** The `name=value` pair of the session cookie a response set, for a `cookie` header. */
export function sessionCookie(res: LightMyRequestResponse): string {
  const cookie = res.cookies.find((c) => c.name.endsWith('session_token'))
  if (!cookie) throw new Error(`no session cookie in response ${res.statusCode}: ${res.body}`)
  return `${cookie.name}=${cookie.value}`
}

/** Creates a household with its first user through the CLI and signs that user in. */
export async function signedInUser(
  cli: Cli,
  server: FastifyInstance,
  name = 'Household',
): Promise<{ email: string; cookie: string; householdId: string; userId: string }> {
  const email = uniqueEmail()
  const result = await cli([
    'household',
    'create',
    '--name',
    name,
    '--email',
    email,
    '--user-name',
    'Ed',
  ])
  if (result.code !== 0) throw new Error(`household create failed:\n${result.stderr}`)
  const res = await signIn(server, email, printedPassword(result))
  const householdId = /household .* \(id ([0-9a-f-]+)/i.exec(result.stdout)?.[1]
  const userId = /user .* \(id ([0-9a-f-]+)/i.exec(result.stdout)?.[1]
  if (!householdId || !userId) throw new Error(`no ids in CLI output:\n${result.stdout}`)
  return { email, cookie: sessionCookie(res), householdId, userId }
}
