// `pnpm lint` for the shell scripts: shellcheck over every script in this
// package. GitHub's Ubuntu runners ship shellcheck; locally, install it
// (brew install shellcheck).
import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { join } from 'node:path'

import { scriptsDir } from './drive.ts'

const fakes = readdirSync(join(scriptsDir, 'provision/fakes')).map((name) =>
  join('provision/fakes', name),
)
const scripts = ['provision.sh', 'image-smoke.sh', ...fakes]

const result = spawnSync('shellcheck', scripts, { cwd: scriptsDir, stdio: 'inherit' })
if (result.error) {
  console.error('shellcheck is not installed (brew install shellcheck).')
  process.exit(1)
}
process.exit(result.status ?? 1)
