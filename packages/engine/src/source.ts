import { z } from 'zod'

/**
 * The source document (docs/spec/engine-pipeline.md section 2, with the
 * `{ text, heading? }` line shape from docs/spec/import-capture.md section 4):
 * the recipe's original text, stored once and never changed. The engine never
 * fetches; ingest produces this.
 */
export const SourceLine = z.object({
  text: z.string(),
  heading: z.boolean().optional(),
})
export type SourceLine = z.infer<typeof SourceLine>

export const SourceDocument = z.object({
  title: z.string(),
  ingredientLines: z.array(SourceLine),
  method: z.array(SourceLine),
  yield: z.string().nullable(),
  times: z.object({
    prepTime: z.string().optional(),
    cookTime: z.string().optional(),
    totalTime: z.string().optional(),
  }),
  sourceDomain: z.string().nullable(),
})
export type SourceDocument = z.infer<typeof SourceDocument>
