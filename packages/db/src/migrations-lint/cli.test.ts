import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'

// The command CI runs over packages/db/migrations (`pnpm migrations:lint`).
const cli = join(import.meta.dirname, 'cli.ts')

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fe-migrations-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function lint() {
  return spawnSync(process.execPath, [cli, dir], { encoding: 'utf8' })
}

test('passes expand-only migrations', () => {
  writeFileSync(join(dir, '0000_init.sql'), 'CREATE TABLE "a" ("id" uuid PRIMARY KEY);\n')
  writeFileSync(join(dir, '0001_more.sql'), 'ALTER TABLE "a" ADD COLUMN "b" text;\n')

  const result = lint()

  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
})

test('fails a new migration with a destructive statement and names it', () => {
  writeFileSync(join(dir, '0000_init.sql'), 'CREATE TABLE "a" ("id" uuid PRIMARY KEY);\n')
  writeFileSync(
    join(dir, '0001_drop.sql'),
    'ALTER TABLE "a" ADD COLUMN "b" text;\n--> statement-breakpoint\nALTER TABLE "a" DROP COLUMN "c";\n',
  )

  const result = lint()

  expect(result.status).toBe(1)
  expect(result.stderr).toContain('0001_drop.sql:3 DROP')
  expect(result.stderr).not.toContain('0000_init.sql')
  expect(result.stderr).toContain('-- contract:')
})

test('passes a destructive migration that carries a contract line', () => {
  writeFileSync(
    join(dir, '0002_contract.sql'),
    '-- contract: drop a.c, unread since the previous release\nALTER TABLE "a" DROP COLUMN "c";\n',
  )

  expect(lint().status).toBe(0)
})

test('fails when the directory has no migrations, so a wrong path cannot pass', () => {
  const result = lint()

  expect(result.status).toBe(1)
  expect(result.stderr).toContain('no migrations')
})
