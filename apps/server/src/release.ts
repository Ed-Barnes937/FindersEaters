// The release step (docs/spec/operations.md section 3.1): what Fly runs before
// a new Machine starts. Each step is transactional and idempotent, so a rerun
// is always safe; the first failure stops the rest and fails the deploy.
import { checkDatabase, connect, migrateDatabase } from '@finders-eaters/db'

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

// The next three are placeholders with their final positions fixed, so the
// tickets that bring the KB artifact, the projections and the recipe table
// replace a body here rather than reorder the release.

/** Loads the KB artifact when its version differs from `ops.meta`'s. */
const loadKnowledgeBase: ReleaseStep = {
  name: 'knowledge base',
  run: () => Promise.resolve('skipped (no KB artifact in this build yet)'),
}

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
  loadKnowledgeBase,
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
