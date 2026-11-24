// Vitest global setup: the release step needs a KB artifact, so build a small
// fixture one once, outside the repo, and point `KB_ARTIFACT` at it. Test
// workers are forked after this runs, so they inherit the variable.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildArtifact, encodeArtifact } from '@finders-eaters/kb'
import { fixtureInputs } from '@finders-eaters/kb/testing'

export default function setup(): () => void {
  const dir = mkdtempSync(join(tmpdir(), 'fe-kb-fixture-'))
  const path = join(dir, 'kb.json.gz')
  writeFileSync(path, encodeArtifact(buildArtifact(fixtureInputs())))
  process.env.KB_ARTIFACT = path
  return () => {}
}
