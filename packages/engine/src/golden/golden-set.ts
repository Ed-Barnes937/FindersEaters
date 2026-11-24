import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

/**
 * The golden set (docs/research/golden-set.md): hand-labelled lines and
 * recipes with the answer the engine should give at each stage. Lines and
 * recipes with no `set` are dev; `heldout` is never tuned on, only reported.
 */
// A verbatim span of the line, null (no such part), or a list of acceptable answers.
const Span = z.union([z.string(), z.array(z.string().nullable())]).nullable()

export const GoldenLine = z.looseObject({
  id: z.string(),
  line: z.string(),
  source: z.string(),
  role: z.enum(['header', 'ingredient', 'note']),
  compound: z.enum(['single', 'compound', 'alternatives']).optional(),
  kind: z.enum(['quantified', 'unquantified', 'not_ingredient']).optional(),
  fields: z
    .object({
      quantity: Span,
      unit: Span,
      size: Span,
      ingredient: Span,
      prep: Span,
      note: Span,
    })
    .optional(),
  resolve: z
    .object({
      candidates: z.record(z.string(), z.string()),
      expected: z.union([z.string(), z.array(z.string())]),
    })
    .optional(),
  unit_system: z.string().optional(),
  set: z.enum(['dev', 'heldout']).optional(),
})
export type GoldenLine = z.infer<typeof GoldenLine>

export const GoldenSet = z.looseObject({
  lines: z.array(GoldenLine),
  recipes: z.array(z.looseObject({ id: z.string(), set: z.enum(['dev', 'heldout']).optional() })),
})
export type GoldenSet = z.infer<typeof GoldenSet>

export type GoldenSetName = 'dev' | 'heldout'

export const defaultGoldenPath = fileURLToPath(
  new URL('../../../../docs/ideation/research/jev-spike/golden.json', import.meta.url),
)

export function loadGolden(path: string = defaultGoldenPath): GoldenSet {
  return GoldenSet.parse(JSON.parse(readFileSync(path, 'utf8')))
}

/** The lines of one set. Held-out lines never leave this function in dev mode. */
export function linesOf(golden: GoldenSet, set: GoldenSetName): GoldenLine[] {
  return golden.lines.filter((line) => (line.set ?? 'dev') === set)
}
