// `cli.ts backup <command>`: the TypeScript half of the nightly backup and the
// staging refresh (docs/spec/operations.md sections 5.2 and 6). The shell half,
// scripts/backup/*.sh, moves dumps between Postgres and the bucket and calls
// these for the decisions.
//
//   backup verify --date <YYYY-MM-DD> --object-key <key> --size-bytes <n>
//                 --out <file> [--previous <file>]
//       Verifies a restored dump (VERIFY_DATABASE_URL) against the database it
//       was taken from (BACKUP_DATABASE_URL, read only) and the previous
//       manifest, then writes the new manifest. Writes nothing on failure.
//   backup fresh --manifest <file> --max-age-hours <n> [--now <ISO time>]
//       Prints the latest verified dump's key, or fails if it is too old.
//
// Exit codes: 0 done, 1 failed, 2 misuse.
import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

import { BackupVerificationError, verifyRestore, type BackupManifest } from './verify.ts'

export interface BackupCliDeps {
  env: NodeJS.ProcessEnv
  out: (line: string) => void
  err: (line: string) => void
}

export const BACKUP_USAGE = `  backup verify --date <YYYY-MM-DD> --object-key <key> --size-bytes <n> --out <file> [--previous <file>]
            (reads VERIFY_DATABASE_URL and BACKUP_DATABASE_URL)
  backup fresh --manifest <file> --max-age-hours <n> [--now <ISO time>]`

class Misuse extends Error {}
class Failure extends Error {}

export async function runBackupCli(argv: string[], deps: BackupCliDeps): Promise<number> {
  const [command, ...rest] = argv
  try {
    if (command === 'verify') await verify(rest, deps)
    else if (command === 'fresh') await fresh(rest, deps)
    else throw new Misuse(`Usage:\n${BACKUP_USAGE}`)
    return 0
  } catch (error) {
    if (error instanceof Misuse) {
      deps.err(error.message)
      return 2
    }
    if (error instanceof Failure || error instanceof BackupVerificationError) {
      deps.err(error.message)
      return 1
    }
    throw error
  }
}

async function verify(args: string[], { env, out }: BackupCliDeps): Promise<void> {
  const opts = options(args, ['date', 'object-key', 'size-bytes', 'out'], ['previous'])
  const restoredUrl = requireEnv(env, 'VERIFY_DATABASE_URL')
  const sourceUrl = requireEnv(env, 'BACKUP_DATABASE_URL')
  const sizeBytes = Number(opts['size-bytes'])
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Misuse(`--size-bytes must be a positive whole number, not "${opts['size-bytes']}"`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date!)) {
    throw new Misuse(`--date must be YYYY-MM-DD, not "${opts.date}"`)
  }

  const previous = opts.previous ? await readManifest(opts.previous) : null
  const manifest = await verifyRestore({
    restoredUrl,
    sourceUrl,
    previous,
    dump: { date: opts.date!, objectKey: opts['object-key']!, sizeBytes },
    log: out,
  })
  await writeFile(opts.out!, `${JSON.stringify(manifest, null, 2)}\n`)
}

async function fresh(args: string[], { out }: BackupCliDeps): Promise<void> {
  const opts = options(args, ['manifest', 'max-age-hours'], ['now'])
  const maxAgeHours = Number(opts['max-age-hours'])
  if (!(maxAgeHours > 0)) throw new Misuse('--max-age-hours must be a positive number')
  const now = opts.now ? new Date(opts.now) : new Date()
  if (Number.isNaN(now.getTime())) throw new Misuse(`--now is not a time: "${opts.now}"`)

  const manifest = await readManifest(opts.manifest!)
  const ageHours = (now.getTime() - Date.parse(manifest.createdAt)) / 3_600_000
  if (ageHours > maxAgeHours) {
    throw new Failure(
      `the latest verified backup (${manifest.objectKey}, verified ${manifest.createdAt}) is ${ageHours.toFixed(1)} hours old, over the ${maxAgeHours} hour limit. Check the nightly backup workflow.`,
    )
  }
  out(manifest.objectKey)
}

async function readManifest(file: string): Promise<BackupManifest> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    throw new Failure(`${file} is not a backup manifest: ${(error as Error).message}`)
  }
  if (!isManifest(parsed)) throw new Failure(`${file} is not a backup manifest`)
  return parsed
}

function isManifest(value: unknown): value is BackupManifest {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Record<string, unknown>
  return (
    typeof m.date === 'string' &&
    typeof m.createdAt === 'string' &&
    !Number.isNaN(Date.parse(m.createdAt)) &&
    typeof m.objectKey === 'string' &&
    typeof m.sizeBytes === 'number' &&
    typeof m.rowCounts === 'object' &&
    m.rowCounts !== null &&
    Object.values(m.rowCounts).every((n) => typeof n === 'number')
  )
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  if (!value) throw new Misuse(`${name} is not set`)
  return value
}

function options(
  args: string[],
  required: string[],
  optional: string[],
): Record<string, string | undefined> {
  let values: Record<string, string | boolean | undefined>
  try {
    values = parseArgs({
      args,
      options: Object.fromEntries([...required, ...optional].map((k) => [k, { type: 'string' }])),
      strict: true,
      allowPositionals: false,
    }).values
  } catch (error) {
    throw new Misuse(`${(error as Error).message}\nUsage:\n${BACKUP_USAGE}`)
  }
  for (const name of required) {
    if (typeof values[name] !== 'string' || values[name] === '') {
      throw new Misuse(`Missing --${name}.\nUsage:\n${BACKUP_USAGE}`)
    }
  }
  return values as Record<string, string | undefined>
}
