// Lints every migration in a directory: `node src/migrations-lint/cli.ts <dir>`.
// Exits 1 when any migration has a destructive statement without a contract line.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lintMigration } from './lint.ts'

const dir = process.argv[2]
if (!dir) {
  process.stderr.write('usage: cli.ts <migrations dir>\n')
  process.exit(2)
}

const files = readdirSync(dir)
  .filter((name) => name.endsWith('.sql'))
  .sort()

if (files.length === 0) {
  process.stderr.write(`no migrations found in ${dir}\n`)
  process.exit(1)
}

const problems = files.flatMap((name) =>
  lintMigration(readFileSync(join(dir, name), 'utf8')).map((v) => `${name}:${v.line} ${v.rule}`),
)

if (problems.length > 0) {
  process.stderr.write(
    [
      'Destructive statements in migrations (docs/spec/operations.md section 4):',
      ...problems.map((p) => `  ${p}`),
      'Migrations are expand-only within a release. If this is a planned contract step,',
      'add a `-- contract: <what and why>` line to the migration (see migrations/README.md).',
      '',
    ].join('\n'),
  )
  process.exit(1)
}

process.stdout.write(`${files.length} migrations are expand-only or marked contract.\n`)
