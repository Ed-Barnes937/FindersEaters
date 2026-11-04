// Operator commands, in the app image next to the server and run against the
// same environment: `node apps/server/src/cli.ts <command>`.
//
//   release   Fly's release_command (docs/spec/operations.md section 3.1):
//             migrate, load the KB, rebuild projections, report staleness.
//             Needs only DATABASE_URL_DIRECT.
//   backup    the nightly backup's restore-verify and the staging refresh's
//             freshness check (docs/spec/operations.md sections 5.2 and 6),
//             called by scripts/backup/*.sh. See ./backup/cli.ts.
//   household / user   the admin CLI (docs/spec/auth.md section 4), e.g.
//             pnpm --filter @finders-eaters/server cli household create \
//               --name "The Barneses" --email ed@example.com --user-name Ed
//
// Exit codes: 0 done, 1 failed, 2 misuse. Run with no arguments for the usage.
import { connect } from '@finders-eaters/db'

import { runBackupCli } from './backup/cli.ts'
import { runCli } from './cli/run.ts'
import { readConfig } from './config.ts'
import { release } from './release.ts'

const args = process.argv.slice(2)

if (args[0] === 'release' && args.length === 1) {
  process.exitCode = await runRelease()
} else if (args[0] === 'backup') {
  process.exitCode = await runBackupCli(args.slice(1), {
    env: process.env,
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  })
} else {
  process.exitCode = await runAdmin(args)
}

async function runRelease(): Promise<number> {
  // The direct (unpooled) URL: the migration advisory lock is per session.
  const url = process.env.DATABASE_URL_DIRECT
  if (!url) {
    process.stderr.write('DATABASE_URL_DIRECT is not set\n')
    return 2
  }
  try {
    await release(url, (line) => process.stdout.write(`${line}\n`))
    return 0
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}

async function runAdmin(argv: string[]): Promise<number> {
  const config = readConfig(process.env)
  const database = connect(config.databaseUrl, { max: 1 })
  try {
    return await runCli(argv, {
      db: database.db,
      auth: config.auth,
      out: (text) => process.stdout.write(`${text}\n`),
      err: (text) => process.stderr.write(`${text}\n`),
    })
  } finally {
    await database.close()
  }
}
