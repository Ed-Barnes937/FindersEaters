// The admin CLI (docs/spec/auth.md section 4). There is no public sign-up:
// households and users are made here, and passwords reset here. Each command
// runs in one transaction, so a failure leaves nothing half-made. Users are
// written through Better Auth's own adapter and password hasher, so the hash
// format is the library's.
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'

import { getHousehold, household, householdUser, type Db } from '@finders-eaters/db'

import { createAuth, type AuthConfig } from '../auth/auth.ts'

export interface CliDeps {
  db: Db
  auth: AuthConfig
  out: (text: string) => void
  err: (text: string) => void
}

const USAGE = `Usage:
  release   (the deploy's release step; reads only DATABASE_URL_DIRECT)
  household create --name <name> --email <email> --user-name <name> [--timezone <IANA zone>]
  user add --household <id> --email <email> --name <name>
  user set-password --email <email>
  user sign-out-all --email <email>
  user remove --email <email>`

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

  'user add': async (args, { db, auth, out }) => {
    const opts = options(args, {
      household: { required: true },
      email: { required: true },
      name: { required: true },
    })
    const password = generatePassword()

    const person = await db.transaction(async (tx) => {
      const home = UUID.test(opts.household) ? await getHousehold(tx, opts.household) : undefined
      if (!home) throw new CliError(`No household with id ${opts.household}.`)
      const created = await createCredentialUser(tx, auth, {
        email: opts.email,
        name: opts.name,
        password,
      })
      await tx.insert(householdUser).values({ householdId: home.id, userId: created.id })
      return created
    })

    out(`Created user ${person.email} (id ${person.id}) in household ${opts.household}.`)
    out(`First password (shown once): ${password}`)
  },

  'user set-password': async (args, { db, auth, out }) => {
    const { email } = options(args, { email: { required: true } })
    const password = generatePassword()

    await db.transaction(async (tx) => {
      const ctx = await authContext(tx, auth)
      const person = await findUser(ctx, email)
      await ctx.internalAdapter.updatePassword(person.id, await ctx.password.hash(password))
      await ctx.internalAdapter.deleteUserSessions(person.id)
    })

    out(`Set a new password for ${normalEmail(email)} and signed out all of their devices.`)
    out(`New password (shown once): ${password}`)
  },

  'user sign-out-all': async (args, { db, auth, out }) => {
    const { email } = options(args, { email: { required: true } })

    await db.transaction(async (tx) => {
      const ctx = await authContext(tx, auth)
      await ctx.internalAdapter.deleteUserSessions((await findUser(ctx, email)).id)
    })

    out(`Signed out all devices of ${normalEmail(email)}.`)
  },

  'user remove': async (args, { db, auth, out }) => {
    const { email } = options(args, { email: { required: true } })

    await db.transaction(async (tx) => {
      const ctx = await authContext(tx, auth)
      // Sessions, credentials and household membership go with the user; rows
      // they created keep existing with `created_by` set to null.
      await ctx.internalAdapter.deleteUser((await findUser(ctx, email)).id)
    })

    out(`Removed user ${normalEmail(email)}.`)
  },
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type AuthContext = Awaited<ReturnType<typeof createAuth>['$context']>

/** Better Auth's internals bound to the command's transaction. */
function authContext(db: Db, config: AuthConfig): Promise<AuthContext> {
  return createAuth(db, config).$context
}

function normalEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function findUser(ctx: AuthContext, email: string): Promise<{ id: string }> {
  const found = await ctx.internalAdapter.findUserByEmail(normalEmail(email))
  if (!found) throw new CliError(`No user with email ${normalEmail(email)}.`)
  return found.user
}

async function createCredentialUser(
  db: Db,
  config: AuthConfig,
  values: { email: string; name: string; password: string },
): Promise<{ id: string; email: string }> {
  const ctx = await authContext(db, config)
  const email = normalEmail(values.email)
  if (await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: false })) {
    throw new CliError(`A user with email ${email} already exists.`)
  }
  const person = await ctx.internalAdapter.createUser(
    { email, name: values.name, emailVerified: false },
    { method: 'admin' },
  )
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
