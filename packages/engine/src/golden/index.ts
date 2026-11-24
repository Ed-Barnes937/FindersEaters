// The golden-set harness (docs/research/golden-set.md, docs/spec/v0.1.md section 17.2).
export {
  defaultGoldenPath,
  GoldenLine,
  GoldenSet,
  linesOf,
  loadGolden,
  type GoldenSetName,
} from './golden-set.ts'
export {
  formatReport,
  runGolden,
  type FieldScore,
  type GoldenReport,
  type Miss,
} from './harness.ts'
