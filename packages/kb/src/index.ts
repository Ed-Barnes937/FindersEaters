// The food knowledge base: build, validate, load (docs/spec/food-knowledge-base.md).
// Read-side lookups (name index, snapshot) arrive with the measures ticket.
export {
  decodeArtifact,
  encodeArtifact,
  type Artifact,
  type ArtifactIngredient,
} from './artifact.ts'
export { buildArtifact, KbBuildError, type BuildInputs } from './build.ts'
export { diffArtifacts, formatDiff, type ArtifactDiff } from './diff.ts'
export { loadedKbVersion, loadKnowledgeBase, type LoadResult } from './load.ts'
export { defaults as kbPaths } from './paths.ts'
export { validateArtifact } from './validate.ts'
