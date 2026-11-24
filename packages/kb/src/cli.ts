// `node packages/kb/src/cli.ts <command>`; see ./run.ts for the commands.
import { runKbCli } from './run.ts'

process.exitCode = await runKbCli(process.argv.slice(2), {
  env: process.env,
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
})
