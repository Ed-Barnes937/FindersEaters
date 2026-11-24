// The engine: `run(input, pins, deps) -> EngineOutput` (docs/spec/engine-pipeline.md).
// Pure apart from the ports in `deps`; owns the zod type of the engine output document.
export { run, type EngineDeps, type KbSnapshot } from './run.ts'
export {
  defaultConfig,
  engineVersion,
  packageVersion,
  type EngineConfig,
  type QuestionMode,
  type StageMode,
} from './config.ts'
export {
  ClefAnswer,
  confidence,
  type ClefClient,
  type ClefQuestion,
  type ClefRequest,
  type ConfidenceFormula,
} from './clef.ts'
export * from './output.ts'
export { SourceDocument, SourceLine } from './source.ts'
export { originalSpan } from './stages/normalise.ts'
