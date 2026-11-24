import { z } from 'zod'

/**
 * The Clef port (docs/spec/engine-pipeline.md section 4, docs/adr/0002). The
 * engine builds typed questions over options code supplied and asks them
 * through this interface; it never does I/O itself. The Workers AI client with
 * cassettes is #41. One request carries all of one line's questions.
 */
export type ClefQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string | null> }
  | { type: 'noul'; instructions: string }

export interface ClefRequest {
  state: Record<string, unknown>
  questions: Record<string, ClefQuestion>
}

/** Clef's answer to one question. The provider's own `confidence` is never read. */
export const ClefAnswer = z.object({
  choice: z.string(),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
})
export type ClefAnswer = z.infer<typeof ClefAnswer>

export interface ClefClient {
  /** Answers keyed by question id. Rejects when Clef is unavailable. */
  ask(request: ClefRequest): Promise<Record<string, unknown>>
}

/** The confidence formulas the engine knows, named in engine configuration. */
export type ConfidenceFormula = 'jev-normalised'

/**
 * The engine's own confidence for Clef's top answer over `n` options: Jev's
 * normalised form, (p_max - 1/n) / (1 - 1/n).
 */
export function confidence(formula: ConfidenceFormula, pMax: number, n: number): number {
  switch (formula) {
    case 'jev-normalised': {
      if (n <= 1) return 1
      const value = (pMax - 1 / n) / (1 - 1 / n)
      return Math.min(1, Math.max(0, value))
    }
  }
}
