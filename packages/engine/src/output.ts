import { z } from 'zod'

/**
 * The engine output document (docs/spec/engine-pipeline.md sections 1, 3 and 5;
 * docs/spec/data-model.md section 4.2). This zod type is the contract: the
 * server stores it as one JSON document per recipe and the review screen, the
 * recipe view, scaling and the shopping list read it.
 *
 * It is derived data, so its shape changes by re-parse under a new engine
 * version, never by data migration.
 */

/** Where a decided value came from, the rung of the ladder that settled it. */
export const DecisionSource = z.enum(['correction', 'rule', 'model', 'derived'])
export type DecisionSource = z.infer<typeof DecisionSource>

/**
 * One decided value. `source: null` is unknown: no rung settled it (Clef was
 * unavailable, or the stage that owns it has not been built yet). A Clef
 * decision keeps Clef's top answer, the confidence the engine computed for it
 * and up to three alternatives with their probabilities; its `value` is the
 * applied value, which is null when a below-gate answer is only offered as a
 * suggestion (resolution and tags).
 */
export function decision<T extends z.ZodType>(value: T) {
  const alternative = z.object({ value, probability: z.number().min(0).max(1) })
  return z.discriminatedUnion('source', [
    z.object({ source: z.literal('correction'), value }),
    z.object({ source: z.literal('rule'), value }),
    z.object({ source: z.literal('derived'), value }),
    z.object({
      source: z.literal('model'),
      value: value.nullable(),
      answer: value,
      confidence: z.number().min(0).max(1),
      alternatives: z.array(alternative).max(3),
    }),
    z.object({ source: z.literal(null), value: z.literal(null) }),
  ])
}

/**
 * A field whose stage is still a stub: always unknown. The ticket that builds
 * the stage replaces it with `decision(<its value type>)`.
 */
export const NotYetDecided = z.object({ source: z.literal(null), value: z.literal(null) })

export const Role = z.enum(['header', 'ingredient', 'note'])
export type Role = z.infer<typeof Role>

/** A line's structure: one ingredient, several, or interchangeable options. */
export const Split = z.enum(['single', 'compound', 'alternatives'])
export type Split = z.infer<typeof Split>

/** Line kind (CONTEXT.md): would you buy it or get it out? */
export const LineKind = z.enum(['quantified', 'unquantified', 'not_ingredient'])
export type LineKind = z.infer<typeof LineKind>

export const RoleDecision = decision(Role)
export const SplitDecision = decision(Split)
export const LineKindDecision = decision(LineKind)

/** One part of an ingredient line: part 0 for a line that was not split. */
export const Part = z.object({
  index: z.int().min(0),
  kind: LineKindDecision,
  quantity: NotYetDecided,
  unit: NotYetDecided,
  size: NotYetDecided,
  ingredient: NotYetDecided,
  prep: NotYetDecided,
  note: NotYetDecided,
  optional: NotYetDecided,
  resolution: NotYetDecided,
  canonical: NotYetDecided,
})
export type Part = z.infer<typeof Part>

export const Line = z.object({
  /** The original line's index in the source document's `ingredientLines`. */
  index: z.int().min(0),
  normalised: z.string(),
  /**
   * The offset map: for each character of `normalised`, the [start, end)
   * range of the original line it came from.
   */
  offsets: z.array(z.tuple([z.int().min(0), z.int().min(0)])),
  role: RoleDecision,
  /** Null when the line is decided not to be an ingredient line. */
  split: SplitDecision.nullable(),
  /** Empty when the line is decided not to be an ingredient line. */
  parts: z.array(Part),
})
export type Line = z.infer<typeof Line>

export const FlagCode = z.enum([
  'low_confidence',
  'review_first',
  'extract_disagreement',
  'no_conversion',
  'implausible_amount',
  'duplicate_ingredient',
  'unit_mismatch',
  'servings_unknown',
  'unit_system_assumed',
  'meal_type_fallback',
  'tag_suggestion',
  'orphaned_correction',
  'arithmetic_quantity',
])
export type FlagCode = z.infer<typeof FlagCode>

/**
 * What a flag points at. `field` names the output field, which is also the
 * correction field (docs/spec/data-model.md section 4.4), so a correction to
 * the target clears the flag.
 */
export const FlagTarget = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('line'),
    lineIndex: z.int().min(0),
    partIndex: z.int().min(0),
    field: z.string(),
  }),
  z.object({ scope: z.literal('recipe'), field: z.string() }),
])
export type FlagTarget = z.infer<typeof FlagTarget>

export const Flag = z.object({
  target: FlagTarget,
  code: FlagCode,
  severity: z.enum(['check', 'info']),
  /** The engine's answer (or, for an orphaned correction, the old value). */
  answer: z.unknown(),
  alternatives: z.array(z.object({ value: z.unknown(), probability: z.number().min(0).max(1) })),
})
export type Flag = z.infer<typeof Flag>

export const RecipeFacts = z.object({
  title: NotYetDecided,
  yield: NotYetDecided,
  totalTime: NotYetDecided,
  unitSystem: NotYetDecided,
  tags: NotYetDecided,
})
export type RecipeFacts = z.infer<typeof RecipeFacts>

export const RunStatus = z.enum(['complete', 'partial'])
export type RunStatus = z.infer<typeof RunStatus>

export const EngineOutput = z.object({
  engineVersion: z.string(),
  kbVersion: z.string(),
  runStatus: RunStatus,
  lines: z.array(Line),
  recipe: RecipeFacts,
  flags: z.array(Flag),
})
export type EngineOutput = z.infer<typeof EngineOutput>
