// `node apps/server/src/cli.ts release`, run as Fly's release_command runs it:
// a child process whose exit code decides whether the deploy goes ahead
// (docs/spec/operations.md section 3.1).
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { createEmptyDatabase, migrationCount, type EmptyDatabase } from '@finders-eaters/db/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url))

// Each test starts a fresh node process, and the release tests also apply every
// migration to an empty database. That takes 1-3 s locally but over 5 s (the
// Vitest default) on a busy CI runner, so these tests get a budget that fits
// the real work instead of timing out at random.
const childProcessTimeout = 30_000

interface Run {
  code: number
  stdout: string
  stderr: string
}

async function run(args: string[], env: Record<string, string>): Promise<Run> {
  try {
    const { stdout, stderr } = await promisify(execFile)('node', [cli, ...args], {
      env: { PATH: process.env.PATH, ...env },
    })
    return { code: 0, stdout, stderr }
  } catch (error) {
    const failed = error as { code: number; stdout: string; stderr: string }
    return { code: failed.code, stdout: failed.stdout, stderr: failed.stderr }
  }
}

let database: EmptyDatabase

beforeEach(async () => {
  database = await createEmptyDatabase('fe_release')
})

afterEach(async () => {
  await database.drop()
})

describe('cli.ts release', { timeout: childProcessTimeout }, () => {
  it('migrates an empty database, runs the KB and projection hooks, then reports staleness', async () => {
    const result = await run(['release'], { DATABASE_URL_DIRECT: database.url })

    expect(result).toMatchObject({ code: 0, stderr: '' })
    expect(result.stdout.trim().split('\n')).toEqual([
      `release: migrate: ${migrationCount()} migrations applied in total`,
      'release: knowledge base: skipped (no KB artifact in this build yet)',
      'release: projections: skipped (no projections in this build yet)',
      'release: staleness: no recipes in this build yet',
      'release: done',
    ])
  })

  it('is safe to rerun: a second release finds nothing to do and succeeds', async () => {
    await run(['release'], { DATABASE_URL_DIRECT: database.url })
    const second = await run(['release'], { DATABASE_URL_DIRECT: database.url })

    expect(second.code).toBe(0)
    expect(second.stdout).toContain(
      `release: migrate: ${migrationCount()} migrations applied in total`,
    )
  })

  it('exits non-zero when a step fails, so Fly aborts the deploy', async () => {
    const result = await run(['release'], {
      DATABASE_URL_DIRECT: 'postgres://postgres:postgres@127.0.0.1:1/none',
    })

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('release failed at migrate')
    expect(result.stdout).not.toContain('release: done')
  })

  it('refuses to run without DATABASE_URL_DIRECT', async () => {
    const result = await run(['release'], {})

    expect(result.code).toBe(2)
    expect(result.stderr).toContain('DATABASE_URL_DIRECT is not set')
  })
})

describe('cli.ts', { timeout: childProcessTimeout }, () => {
  it('rejects an unknown command with usage that lists release', async () => {
    const result = await run(['nope'], {
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:1/none',
      BETTER_AUTH_SECRET: 'test-only-secret-that-is-long-enough-for-better-auth',
      BETTER_AUTH_URL: 'http://localhost:4173',
    })

    expect(result.code).toBe(2)
    expect(result.stderr).toMatch(/Usage:\n {2}release /)
  })
})
