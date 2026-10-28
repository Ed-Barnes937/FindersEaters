// Operator commands: `node apps/server/src/cli.ts <command>`. Fly runs
// `release` as the release_command; the rest arrive with their tickets
// (docs/spec/v0.1.md section 4). Exit codes: 0 done, 1 failed, 2 misuse.
import { release } from './release.ts'

const USAGE =
  'usage: cli.ts <command>\n\ncommands:\n  release   migrate, load the KB, rebuild projections, report staleness\n'

const [command] = process.argv.slice(2)

switch (command) {
  case 'release': {
    // The direct (unpooled) URL: the migration advisory lock is per session.
    const url = process.env.DATABASE_URL_DIRECT
    if (!url) {
      process.stderr.write('DATABASE_URL_DIRECT is not set\n')
      process.exit(2)
    }
    try {
      await release(url, (line) => process.stdout.write(`${line}\n`))
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      process.exit(1)
    }
    break
  }
  default:
    process.stderr.write(USAGE)
    process.exit(2)
}
