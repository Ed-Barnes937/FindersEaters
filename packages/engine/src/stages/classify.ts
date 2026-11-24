import type { EngineConfig } from '../config.ts'
import type { LineKind } from '../output.ts'
import { escape } from './segment.ts'

type ClassifyRules = EngineConfig['rules']['classify']

/**
 * Stage 3, classify line kind: the rules (docs/spec/engine-pipeline.md section
 * 3). Tap water and ice, with or without an amount, are not an ingredient. No
 * quantity token and a phrase like "to taste" is unquantified. Anything else
 * is Clef's.
 */
export function kindByRule(text: string, rules: ClassifyRules): LineKind | null {
  const lower = text.toLowerCase()
  if (isTapWaterOrIce(lower, rules)) return 'not_ingredient'
  if (
    !hasQuantityToken(lower, rules) &&
    rules.unquantifiedPhrases.some((p) => hasWords(lower, p))
  ) {
    return 'unquantified'
  }
  return null
}

function hasWords(lower: string, phrase: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(phrase)}(?![\\p{L}\\p{N}])`, 'u').test(lower)
}

function hasQuantityToken(lower: string, rules: ClassifyRules): boolean {
  return /\d/.test(lower) || rules.quantityWords.some((word) => hasWords(lower, word))
}

/**
 * The line names nothing but water or ice: drop bracketed asides and anything
 * after the first comma (prep and notes), then amount, unit, temperature and
 * filler words, and see what is left.
 */
function isTapWaterOrIce(lower: string, rules: ClassifyRules): boolean {
  const head = lower.replace(/\([^)]*\)/g, ' ').split(',')[0]!
  const words = (head.match(/\p{L}+/gu) ?? []).filter(
    (word) => !rules.notIngredientIgnoredWords.includes(word),
  )
  return rules.notIngredientResidues.includes(words.join(' '))
}
