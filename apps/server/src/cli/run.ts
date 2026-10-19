// The admin CLI (docs/spec/auth.md section 4). There is no public sign-up:
// households and users are made here, and passwords reset here. Each command
// runs in one transaction, so a failure leaves nothing half-made. Users are
// written through Better Auth's own adapter and password hasher, so the hash
// format is the library's.
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'

import { household, householdUser, type Db } from '@finders-eaters/db'

import { createAuth, type AuthConfig } from '../auth/auth.ts'

export interface CliDeps {
  db: Db
  auth: AuthConfig
  out: (text: string) => void
  err: (text: string) => void
}

const USAGE = `Usage:
  household create --name <name> --email <email> --user-name <name> [--timezone <IANA zone>]`

/** A failure the admin can fix: printed without a stack, exit code 1. */
class CliError extends Error {}

export async function runCli(argv: string[], deps: CliDeps): Promise<number> {
  try {
    const [group, command, ...rest] = argv
    const key = `${group ?? ''} ${command ?? ''}`
    const run = commands[key]
    if (!run) {
      deps.err(USAGE)
      return 2
    }
    await run(rest, deps)
    return 0
  } catch (error) {
    if (error instanceof CliError) {
      deps.err(error.message)
      return 1
    }
    throw error
  }
}

type Command = (args: string[], deps: CliDeps) => Promise<void>

const commands: Record<string, Command> = {
  'household create': async (args, { db, auth, out }) => {
    const opts = options(args, {
      name: { required: true },
      email: { required: true },
      'user-name': { required: true },
      timezone: { default: 'Europe/London' },
    })
    const timezone = validTimezone(opts.timezone)
    const password = generatePassword()

    const created = await db.transaction(async (tx) => {
      const [home] = await tx.insert(household).values({ name: opts.name, timezone }).returning()
      const person = await createCredentialUser(tx, auth, {
        email: opts.email,
        name: opts['user-name'],
        password,
      })
      await tx.insert(householdUser).values({ householdId: home!.id, userId: person.id })
      return { home: home!, person }
    })

    out(`Created household "${created.home.name}" (id ${created.home.id}, timezone ${timezone}).`)
    out(`Created user ${created.person.email} (id ${created.person.id}).`)
    out(`First password (shown once): ${password}`)
  },
}

async function createCredentialUser(
  db: Db,
  config: AuthConfig,
  values: { email: string; name: string; password: string },
): Promise<{ id: string; email: string }> {
  const ctx = await createAuth(db, config).$context
  const email = values.email.trim().toLowerCase()
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    throw new CliError(`A user with email ${email} already exists.`)
  }
  const person = await ctx.internalAdapter.createUser({
    email,
    name: values.name,
    emailVerified: false,
  })
  await ctx.internalAdapter.linkAccount({
    userId: person.id,
    providerId: 'credential',
    accountId: person.id,
    password: await ctx.password.hash(values.password),
  })
  return { id: person.id, email: person.email }
}

/** 18 random bytes as base64url: 24 characters, inside the 12 to 128 rule. */
function generatePassword(): string {
  return randomBytes(18).toString('base64url')
}

function validTimezone(zone: string): string {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone })
    return zone
  } catch {
    throw new CliError(`Unknown timezone "${zone}". Use an IANA zone such as Europe/London.`)
  }
}

type OptionSpec = { required: true } | { default: string }

function options<S extends Record<string, OptionSpec>>(
  args: string[],
  spec: S,
): Record<keyof S, string> {
  let values: Record<string, string | boolean | undefined>
  try {
    values = parseArgs({
      args,
      options: Object.fromEntries(Object.keys(spec).map((k) => [k, { type: 'string' }])),
      strict: true,
      allowPositionals: false,
    }).values
  } catch (error) {
    throw new CliError(`${(error as Error).message}\n${USAGE}`)
  }
  const result: Record<string, string> = {}
  for (const [name, rule] of Object.entries(spec)) {
    const value = values[name]
    if (typeof value === 'string' && value.trim() !== '') result[name] = value.trim()
    else if ('default' in rule) result[name] = rule.default
    else throw new CliError(`Missing --${name}.\n${USAGE}`)
  }
  return result as Record<keyof S, string>
}
