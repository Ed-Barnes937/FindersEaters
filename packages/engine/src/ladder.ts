import { ClefAnswer, confidence, type ClefQuestion, type ConfidenceFormula } from './clef.ts'
import type { ChoiceTemplate, QuestionMode } from './config.ts'
import type { Flag, FlagCode, FlagTarget } from './output.ts'

/**
 * The decision ladder (docs/spec/engine-pipeline.md section 1): pin, then rule,
 * then Clef over options code supplied, then a review flag.
 */

/** A value a pin or a rule settled before Clef is asked. */
export type Settled<T> = { source: 'correction' | 'rule'; value: T }

export interface ModelDecision<T> {
  source: 'model'
  value: T
  answer: T
  confidence: number
  alternatives: { value: T; probability: number }[]
}

export type Decided<T> = Settled<T> | ModelDecision<T> | { source: null; value: null }

export const unknownDecision = { source: null, value: null } as const

export function choiceQuestion(template: ChoiceTemplate): ClefQuestion {
  return { type: 'choice', instructions: template.instructions, criteria: { ...template.criteria } }
}

/** Thrown when an answer is not one the engine can use; the run then goes partial. */
export class UnusableAnswer extends Error {}

/**
 * Clef's answer to a choice over `options`, with the engine's own confidence
 * (the provider's is never read) and up to three alternatives.
 */
export function modelDecision<T extends string>(
  raw: unknown,
  options: readonly T[],
  formula: ConfidenceFormula,
): ModelDecision<T> {
  const parsed = ClefAnswer.safeParse(raw)
  if (!parsed.success) throw new UnusableAnswer('Clef answer is malformed')
  const choice = options.find((o) => o === parsed.data.choice)
  if (choice === undefined) throw new UnusableAnswer('Clef chose an option it was not offered')
  const probability = (option: T) => parsed.data.probabilities[option] ?? 0
  return {
    source: 'model',
    value: choice,
    answer: choice,
    confidence: confidence(formula, probability(choice), options.length),
    alternatives: options
      .filter((o) => o !== choice)
      .map((o) => ({ value: o, probability: probability(o) }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 3),
  }
}

/** The review flag a Clef decision earns under its question's mode, if any. */
export function reviewFlag<T>(
  decided: ModelDecision<T>,
  mode: QuestionMode,
  target: FlagTarget,
): Flag | null {
  let code: FlagCode | null = null
  if (mode.mode === 'review-first') code = 'review_first'
  else if (decided.confidence < mode.gate) code = 'low_confidence'
  if (!code) return null
  return {
    target,
    code,
    severity: 'check',
    answer: decided.answer,
    alternatives: decided.alternatives,
  }
}
