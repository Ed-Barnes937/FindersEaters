// The admin CLI entrypoint (docs/spec/auth.md section 4), in the app image next
// to the server and run against the same environment:
//
//   pnpm --filter @finders-eaters/server cli household create --name "The Barneses" \
//     --email ed@example.com --user-name Ed
//
// Run with no arguments for the full usage.
import { connect } from '@finders-eaters/db'

import { runCli } from './cli/run.ts'
import { readConfig } from './config.ts'

const config = readConfig(process.env)
const database = connect(config.databaseUrl, { max: 1 })
try {
  process.exitCode = await runCli(process.argv.slice(2), {
    db: database.db,
    auth: config.auth,
    out: (text) => process.stdout.write(`${text}\n`),
    err: (text) => process.stderr.write(`${text}\n`),
  })
} finally {
  await database.close()
}
