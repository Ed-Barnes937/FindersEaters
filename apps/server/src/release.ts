// The release step (docs/spec/operations.md section 3.1): what Fly runs before
// a new Machine starts. Each step is transactional and idempotent, so a rerun
// is always safe; the first failure stops the rest and fails the deploy.
import { readFile } from 'node:fs/promises'
import { checkDatabase, connect, migrateDatabase } from '@finders-eaters/db'
import { decodeArtifact, kbPaths, loadKnowledgeBase } from '@finders-eaters/kb'

interface ReleaseStep {
  name: string
  /** Does the work and returns the one-line summary for the deploy log. */
  run: (databaseUrl: string) => Promise<string>
}

const migrate: ReleaseStep = {
  name: 'migrate',
  async run(databaseUrl) {
    await migrateDatabase(databaseUrl)
    const { db, close } = connect(databaseUrl, { max: 1 })
    try {
      const health = await checkDatabase(db)
      if (!health.ok) throw new Error(`database check after migrate failed: ${health.error}`)
      const n = health.migrationsApplied
      return `${n} migration${n === 1 ? '' : 's'} applied in total`
    } finally {
      await close()
    }
  },
}

/**
 * Where the release finds the KB artifact: `KB_ARTIFACT`, else the path the
 * image build copies it to. A missing artifact fails the release.
 */
function kbArtifactPath(): string {
  return process.env.KB_ARTIFACT ?? kbPaths.artifact
}

/** Loads the KB artifact when its version differs from `ops.meta`'s. */
const loadKnowledgeBaseStep: ReleaseStep = {
  name: 'knowledge base',
  async run(databaseUrl) {
    const path = kbArtifactPath()
    let bytes: Buffer
    try {
      bytes = await readFile(path)
    } catch (cause) {
      throw new Error(`no KB artifact at ${path}: the image build must run \`kb build\` first`, {
        cause,
      })
    }
    const artifact = decodeArtifact(bytes)
    const { db, close } = connect(databaseUrl, { max: 1 })
    try {
      const result = await loadKnowledgeBase(db, artifact)
      if (!result.loaded) return `${result.version} already loaded`
      const retired = result.vanished > 0 ? `, ${result.vanished} retired as vanished` : ''
      return `loaded ${result.version} (${result.ingredients} ingredients${retired}); recipes are KB-stale until re-resolved`
    } finally {
      await close()
    }
  },
}

// The next two are placeholders with their final positions fixed, so the
// tickets that bring the projections and the recipe table replace a body here
// rather than reorder the release.

/** Rebuilds `recipe_tag`, `recipe_line` and `needs_review` on a projection version change. */
const rebuildProjections: ReleaseStep = {
  name: 'projections',
  run: () => Promise.resolve('skipped (no projections in this build yet)'),
}

/** Counts recipes with a stale engine or KB version, so the log says if a batch re-parse is due. */
const reportStaleness: ReleaseStep = {
  name: 'staleness',
  run: () => Promise.resolve('no recipes in this build yet'),
}

const steps: readonly ReleaseStep[] = [
  migrate,
  loadKnowledgeBaseStep,
  rebuildProjections,
  reportStaleness,
]

export async function release(databaseUrl: string, log: (line: string) => void): Promise<void> {
  for (const step of steps) {
    let summary: string
    try {
      summary = await step.run(databaseUrl)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`release failed at ${step.name}: ${reason}`, { cause: error })
    }
    log(`release: ${step.name}: ${summary}`)
  }
  log('release: done')
}
