// `node apps/server/src/cli.ts backup ...`, run as scripts/backup/*.sh run it:
// a child process whose exit code decides whether the backup job, or the
// staging refresh, goes on (docs/spec/operations.md sections 5.2 and 6).
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { connect, migrateDatabase } from '@finders-eaters/db'
import {
  createEmptyDatabase,
  createHousehold,
  type EmptyDatabase,
} from '@finders-eaters/db/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { BackupManifest } from './verify.ts'

const cli = fileURLToPath(new URL('../cli.ts', import.meta.url))

interface Run {
  code: number
  stdout: string
  stderr: string
}

async function run(args: string[], env: Record<string, string> = {}): Promise<Run> {
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

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'fe-backup-cli-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function manifest(values: Partial<BackupManifest> = {}): BackupManifest {
  return {
    date: '2026-10-27',
    createdAt: '2026-10-27T03:20:00.000Z',
    objectKey: 'daily/2026-10-27.dump',
    sizeBytes: 1000,
    rowCounts: { 'public.household': 1 },
    migrations: { applied: 2, head: 'a'.repeat(64) },
    kbVersion: null,
    ...values,
  }
}

describe('cli.ts backup verify', () => {
  let source: EmptyDatabase
  let restored: EmptyDatabase

  beforeEach(async () => {
    source = await createEmptyDatabase('fe_bcli_src')
    restored = await createEmptyDatabase('fe_bcli_dst')
    for (const url of [source.url, restored.url]) {
      await migrateDatabase(url)
      const { db, close } = connect(url, { max: 1 })
      await createHousehold(db)
      await close()
    }
  })

  afterEach(async () => {
    await source.drop()
    await restored.drop()
  })

  const args = (out: string) => [
    'backup',
    'verify',
    '--date',
    '2026-10-28',
    '--object-key',
    'daily/2026-10-28.dump',
    '--size-bytes',
    '4321',
    '--out',
    out,
  ]

  it('writes the new manifest when the restore verifies', async () => {
    const out = join(dir, 'latest.json')

    const result = await run(args(out), {
      VERIFY_DATABASE_URL: restored.url,
      BACKUP_DATABASE_URL: source.url,
    })

    expect(result).toMatchObject({ code: 0, stderr: '' })
    expect(result.stdout).toContain('verify: passed')
    const written = JSON.parse(await readFile(out, 'utf8')) as BackupManifest
    expect(written).toMatchObject({
      date: '2026-10-28',
      objectKey: 'daily/2026-10-28.dump',
      sizeBytes: 4321,
      rowCounts: { 'public.household': 1 },
    })
  })

  it('fails loudly against the previous manifest, and writes no manifest', async () => {
    const previous = join(dir, 'previous.json')
    await writeFile(previous, JSON.stringify(manifest({ rowCounts: { 'public.household': 3 } })))
    const out = join(dir, 'latest.json')

    const result = await run([...args(out), '--previous', previous], {
      VERIFY_DATABASE_URL: restored.url,
      BACKUP_DATABASE_URL: source.url,
    })

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('backup verification failed:')
    expect(result.stderr).toContain(
      'public.household has 1 row, fewer than the 3 in the previous backup (daily/2026-10-27.dump)',
    )
    await expect(readFile(out, 'utf8')).rejects.toThrow(/ENOENT/)
  })

  it('refuses to run without both database URLs', async () => {
    const result = await run(args(join(dir, 'x.json')), { BACKUP_DATABASE_URL: source.url })

    expect(result.code).toBe(2)
    expect(result.stderr).toContain('VERIFY_DATABASE_URL is not set')
  })
})

describe('cli.ts backup fresh', () => {
  async function fresh(createdAt: string, now: string): Promise<Run> {
    const file = join(dir, 'latest.json')
    await writeFile(file, JSON.stringify(manifest({ createdAt })))
    return run(['backup', 'fresh', '--manifest', file, '--max-age-hours', '36', '--now', now])
  }

  it('prints the latest verified dump when it is recent enough', async () => {
    const result = await fresh('2026-10-27T03:20:00.000Z', '2026-10-28T15:19:00.000Z')

    expect(result).toMatchObject({ code: 0, stdout: 'daily/2026-10-27.dump\n' })
  })

  it('fails when the latest verified backup is older than the limit', async () => {
    const result = await fresh('2026-10-27T03:20:00.000Z', '2026-10-28T15:21:00.000Z')

    expect(result.code).toBe(1)
    expect(result.stderr).toContain(
      'the latest verified backup (daily/2026-10-27.dump, verified 2026-10-27T03:20:00.000Z) is 36.0 hours old, over the 36 hour limit',
    )
  })

  it('rejects a manifest that is not one', async () => {
    const file = join(dir, 'latest.json')
    await writeFile(file, '{"date":"2026-10-27"}')

    const result = await run(['backup', 'fresh', '--manifest', file, '--max-age-hours', '36'])

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('is not a backup manifest')
  })
})
