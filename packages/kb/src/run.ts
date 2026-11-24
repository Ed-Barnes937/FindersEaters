// The `kb` commands (docs/spec/food-knowledge-base.md section 8):
//
//   build [--previous <artifact>]   download the pinned sources (checksums
//                       verified, cached), apply the own layer, validate, write the artifact
//   validate [artifact]  check a built artifact
//   diff <old> <new>     the diff report between two artifacts
//   load [artifact]      load into the database named by DATABASE_URL_DIRECT
//
// Exit codes: 0 done, 1 failed, 2 misuse.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import { connect } from '@finders-eaters/db'
import { decodeArtifact, encodeArtifact, type Artifact } from './artifact.ts'
import { buildArtifact, KbBuildError } from './build.ts'
import { diffArtifacts, formatDiff } from './diff.ts'
import { loadKnowledgeBase } from './load.ts'
import { readOwnLayer } from './own.ts'
import { defaults } from './paths.ts'
import { parseIntake24 } from './sources/intake24.ts'
import { fetchSources } from './sources/fetch.ts'
import { parseOffTaxonomy } from './sources/off.ts'
import { readSourcePins } from './sources/pins.ts'
import { parseUsda } from './sources/usda.ts'
import { validateArtifact } from './validate.ts'

export interface CliIo {
  env: Record<string, string | undefined>
  out: (line: string) => void
  err: (line: string) => void
}

const usage = `usage: kb <command>
  build [--previous <artifact>] [--sources <file>] [--own <dir>] [--cache-dir <dir>] [--out <file>]
  validate [artifact]
  diff <old-artifact> <new-artifact>
  load [artifact]        (needs DATABASE_URL_DIRECT)`

async function readArtifact(path: string): Promise<Artifact> {
  return decodeArtifact(await readFile(path))
}

export async function runKbCli(argv: string[], io: CliIo): Promise<number> {
  const [command, ...rest] = argv
  try {
    switch (command) {
      case 'build':
        return await build(rest, io)
      case 'validate':
        return await validate(rest, io)
      case 'diff':
        return await diff(rest, io)
      case 'load':
        return await load(rest, io)
      default:
        io.err(usage)
        return 2
    }
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error))
    return 1
  }
}

async function build(argv: string[], io: CliIo): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      previous: { type: 'string' },
      sources: { type: 'string', default: defaults.sources },
      own: { type: 'string', default: defaults.own },
      'cache-dir': { type: 'string', default: defaults.cache },
      out: { type: 'string', default: defaults.artifact },
    },
  })
  const pins = await readSourcePins(values.sources)
  const texts = await fetchSources(pins, values['cache-dir'])
  let artifact: Artifact
  try {
    artifact = buildArtifact({
      pins,
      off: parseOffTaxonomy(texts.off),
      intake24: parseIntake24(texts.intake24),
      usda: parseUsda(texts.usda),
      own: await readOwnLayer(values.own),
    })
  } catch (error) {
    if (!(error instanceof KbBuildError)) throw error
    io.err(error.message)
    return 1
  }
  const previous = values.previous ? await readArtifact(values.previous) : undefined
  const problems = validateArtifact(artifact, { previous })
  if (problems.length > 0) {
    io.err(`KB validation failed:\n- ${problems.join('\n- ')}`)
    return 1
  }
  await mkdir(dirname(values.out), { recursive: true })
  await writeFile(values.out, encodeArtifact(artifact))
  io.out(
    `kb build: version ${artifact.kbVersion}: ${artifact.ingredients.length} ingredients, ${artifact.edges.length} edges, ${artifact.names.length} names -> ${values.out}`,
  )
  io.out(`kb build: ${artifact.audit.madeFromCandidates.length} "made from" candidates to review`)
  if (previous) io.out(formatDiff(diffArtifacts(previous, artifact)))
  return 0
}

async function validate(argv: string[], io: CliIo): Promise<number> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true, options: {} })
  const path = positionals[0] ?? defaults.artifact
  const problems = validateArtifact(await readArtifact(path))
  if (problems.length > 0) {
    io.err(`KB validation failed:\n- ${problems.join('\n- ')}`)
    return 1
  }
  io.out(`kb validate: ${path} is valid`)
  return 0
}

async function diff(argv: string[], io: CliIo): Promise<number> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true, options: {} })
  if (positionals.length !== 2) {
    io.err(usage)
    return 2
  }
  const [before, after] = await Promise.all(positionals.map(readArtifact))
  io.out(formatDiff(diffArtifacts(before!, after!)))
  return 0
}

async function load(argv: string[], io: CliIo): Promise<number> {
  const { positionals } = parseArgs({ args: argv, allowPositionals: true, options: {} })
  const url = io.env.DATABASE_URL_DIRECT
  if (!url) {
    io.err('DATABASE_URL_DIRECT is not set')
    return 2
  }
  const artifact = await readArtifact(positionals[0] ?? defaults.artifact)
  const { db, close } = connect(url, { max: 1 })
  try {
    const result = await loadKnowledgeBase(db, artifact)
    io.out(
      result.loaded
        ? `kb load: loaded ${result.version} (${result.ingredients} ingredients, ${result.vanished} retired as vanished; was ${result.previousVersion ?? 'empty'})`
        : `kb load: ${result.version} is already loaded`,
    )
    return 0
  } finally {
    await close()
  }
}
