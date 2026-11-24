// `kb build | validate | diff | load`, run in-process against fixture sources
// seeded into the download cache, so nothing touches the network.
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { connect, migrateDatabase } from '@finders-eaters/db'
import { createEmptyDatabase, type EmptyDatabase } from '@finders-eaters/db/testing'
import { zipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decodeArtifact } from './artifact.ts'
import { loadedKbVersion } from './load.ts'
import { runKbCli } from './run.ts'
import { intake24Xml, offText, ownFiles, usdaFiles } from './testing/fixtures.ts'

const enc = (s: string) => new TextEncoder().encode(s)
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')

let dir: string
let output: string[]
let errors: string[]
const io = () => ({
  env: {} as Record<string, string | undefined>,
  out: (line: string) => void output.push(line),
  err: (line: string) => void errors.push(line),
})
const paths = () => ({
  sources: join(dir, 'sources.json'),
  own: join(dir, 'own'),
  cache: join(dir, 'cache'),
  out: join(dir, 'dist', 'kb.json.gz'),
})
const build = (...extra: string[]) => {
  const p = paths()
  return runKbCli(
    [
      'build',
      '--sources',
      p.sources,
      '--own',
      p.own,
      '--cache-dir',
      p.cache,
      '--out',
      p.out,
      ...extra,
    ],
    io(),
  )
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'kb-cli-'))
  output = []
  errors = []
  const p = paths()
  await mkdir(p.cache, { recursive: true })
  await mkdir(p.own, { recursive: true })
  const zip = zipSync({
    'sr/food.csv': enc(usdaFiles.food),
    'sr/food_portion.csv': enc(usdaFiles.portion),
    'sr/measure_unit.csv': enc(usdaFiles.measureUnit),
  })
  const git = { repo: 'o/r', commit: 'a'.repeat(40), path: 'p', url: 'https://example.invalid/x' }
  for (const body of [enc(offText), enc(intake24Xml), zip])
    await writeFile(join(p.cache, sha(body)), body)
  await writeFile(
    p.sources,
    JSON.stringify({
      off: { ...git, sha256: sha(enc(offText)) },
      intake24: { ...git, sha256: sha(enc(intake24Xml)) },
      usda: { release: 'sr', url: git.url, sha256: sha(zip) },
    }),
  )
  for (const [name, text] of Object.entries(ownFiles)) await writeFile(join(p.own, name), text)
})

afterEach(() => rm(dir, { recursive: true, force: true }))

describe('kb build', () => {
  it('writes a validated artifact and reports its version', async () => {
    expect(await build()).toBe(0)
    const artifact = decodeArtifact(await readFile(paths().out))
    expect(output.join('\n')).toContain(artifact.kbVersion)
  })

  it('rebuilding with unchanged inputs yields the same version and the same bytes', async () => {
    await build()
    const first = await readFile(paths().out)
    await build()
    expect((await readFile(paths().out)).equals(first)).toBe(true)
  })

  it('fails without writing an artifact when the own layer breaks validation', async () => {
    await writeFile(join(paths().own, 'aisles.yaml'), '- ingredient: unobtainium\n  aisle: x\n')
    expect(await build()).toBe(1)
    expect(errors.join('\n')).toMatch(/unobtainium/)
    await expect(readFile(paths().out)).rejects.toThrow()
  })

  it('fails the build when a vanished ingredient has no replaced_by, given the previous artifact', async () => {
    await build()
    const previous = join(dir, 'previous.json.gz')
    await writeFile(previous, await readFile(paths().out))
    await writeFile(
      join(paths().own, 'ingredients.yaml'),
      '- key: plain-flour\n  slug: plain-flour\n  name: Plain flour\n  parents: [wheat-flour]\n',
    )

    expect(await build('--previous', previous)).toBe(1)
    expect(errors.join('\n')).toMatch(/bicarbonate-of-soda.*replaced_by/)
  })

  it('prints the diff report against a previous artifact', async () => {
    await build()
    const previous = join(dir, 'previous.json.gz')
    await writeFile(previous, await readFile(paths().out))
    await writeFile(join(paths().own, 'aisles.yaml'), '- ingredient: vegetable\n  aisle: produce\n')
    expect(await build('--previous', previous)).toBe(0)
    expect(output.join('\n')).toMatch(
      /no changes|measure|property|added|retired|renamed|reparented/,
    )
  })
})

describe('kb validate', () => {
  it('passes a built artifact and fails bytes that are not one', async () => {
    await build()
    expect(await runKbCli(['validate', paths().out], io())).toBe(0)
    await writeFile(join(dir, 'bad.json.gz'), 'nope')
    expect(await runKbCli(['validate', join(dir, 'bad.json.gz')], io())).toBe(1)
  })
})

describe('kb load', () => {
  let database: EmptyDatabase
  beforeEach(async () => {
    database = await createEmptyDatabase('fe_kbcli')
    await migrateDatabase(database.url)
  })
  afterEach(() => database.drop())

  it('loads the artifact once, then reports it is already loaded', async () => {
    await build()
    const env = { DATABASE_URL_DIRECT: database.url }
    expect(await runKbCli(['load', paths().out], { ...io(), env })).toBe(0)
    expect(output.join('\n')).toMatch(/loaded/i)

    output.length = 0
    expect(await runKbCli(['load', paths().out], { ...io(), env })).toBe(0)
    expect(output.join('\n')).toMatch(/already loaded/i)

    const { db, close } = connect(database.url, { max: 1 })
    try {
      expect(await loadedKbVersion(db)).toBe(decodeArtifact(await readFile(paths().out)).kbVersion)
    } finally {
      await close()
    }
  })

  it('exits 2 without a database url', async () => {
    await build()
    expect(await runKbCli(['load', paths().out], io())).toBe(2)
  })
})

describe('usage', () => {
  it('exits 2 for an unknown command', async () => {
    expect(await runKbCli(['frobnicate'], io())).toBe(2)
    expect(errors.join('\n')).toMatch(/usage/i)
  })
})
