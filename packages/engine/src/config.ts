import { createHash } from 'node:crypto'
import packageJson from '../package.json' with { type: 'json' }
import type { ConfidenceFormula } from './clef.ts'

export type StageMode = 'auto' | 'review-first'

/** How one Clef question's answers are accepted (docs/spec/engine-pipeline.md section 4). */
export interface QuestionMode {
  mode: StageMode
  /** The confidence an answer needs to be accepted without a flag under `auto`. */
  gate: number
}

export interface ChoiceTemplate {
  instructions: string
  criteria: Record<string, string>
}

/**
 * Everything that can change engine output except the knowledge base and the
 * engine's code (docs/spec/engine-pipeline.md section 7). All of it feeds the
 * engine version. The Clef base URL and credentials are deployment settings of
 * the client, not engine configuration: they change no output.
 *
 * Rule logic is code: a change to it bumps the package version. The data the
 * rules read (phrases, word lists, lexicons) lives here, so changing it changes
 * the config hash.
 */
export interface EngineConfig {
  model: {
    /** Workers AI model id (docs/adr/0002). */
    id: string
    /**
     * SHA-256 of the canonicalised answers to the dev golden requests, set by
     * the canary's re-baseline (#66). Null until first baselined.
     */
    answerFingerprint: string | null
  }
  confidenceFormula: ConfidenceFormula
  taxonomyVersion: string
  framing: {
    version: string
    questions: {
      role: ChoiceTemplate
      compound: ChoiceTemplate
      kind: ChoiceTemplate
    }
  }
  questions: {
    segmentRole: QuestionMode
    segmentStructure: QuestionMode
    classifyKind: QuestionMode
  }
  rules: {
    segment: {
      /** Lowercased line starts that make a line a header ("For the ..."). */
      headerPrefixes: string[]
      /** Whole words that are split points. */
      splitWords: string[]
      /** Characters that are split points. */
      splitMarks: string[]
    }
    classify: {
      /** Phrases that, on a line with no quantity token, make it unquantified. */
      unquantifiedPhrases: string[]
      /** Whole words that count as a quantity token, besides digits. */
      quantityWords: string[]
      /** What is left of a tap-water or ice line once ignored words go. */
      notIngredientResidues: string[]
      /** Amount, unit, temperature and filler words ignored by the tap-water rule. */
      notIngredientIgnoredWords: string[]
    }
  }
}

// The v2 framing's line questions, unchanged from the spike
// (docs/ideation/research/jev-spike/run_spike.py, `--framing v2`): thresholds
// are only valid for the exact template they were tuned on.
const ROLE_CRITERIA = {
  header:
    "A section heading inside the ingredient list, such as 'For the dressing:'. Names no ingredient to buy.",
  ingredient: 'Names a food or drink item used in the recipe, with or without an amount.',
  note: 'A remark, tip, serving count or instruction that names no ingredient to buy.',
}
const COMPOUND_CRITERIA = {
  single:
    "Exactly one ingredient, even if its name contains 'and' (e.g. 'sweet and sour sauce', 'fish and chip seasoning').",
  compound:
    "Two or more separate ingredients on one line that would be bought or fetched separately (e.g. 'oil and vinegar').",
  alternatives: "One ingredient slot with interchangeable options (e.g. 'lard or dripping').",
}
const KIND_CRITERIA = {
  quantified:
    "An ingredient with an amount, even a vague one ('150g pasta', 'a dash of soy sauce'). It scales and goes on the shopping list.",
  unquantified:
    "An ingredient you would buy or get out, but with no amount ('sea salt', 'vegetable oil, for deep-frying').",
  not_ingredient:
    "Not something you would buy or get out; it belongs in the method ('a little hot water to loosen').",
}

export const defaultConfig: EngineConfig = {
  model: { id: '@cf/cloudflare/clef', answerFingerprint: null },
  confidenceFormula: 'jev-normalised',
  taxonomyVersion: 'v01',
  framing: {
    version: 'v2',
    questions: {
      role: {
        instructions: "What kind of line is `line` in a recipe's ingredient list?",
        criteria: ROLE_CRITERIA,
      },
      compound: {
        instructions: 'How many separate ingredients does `line` name?',
        criteria: COMPOUND_CRITERIA,
      },
      kind: {
        instructions: 'Would you buy or get out the item in `line`, and does it state an amount?',
        criteria: KIND_CRITERIA,
      },
    },
  },
  // The held-out run's verdicts (docs/spec/engine-pipeline.md section 4).
  questions: {
    segmentRole: { mode: 'auto', gate: 0.8 },
    segmentStructure: { mode: 'review-first', gate: 0.8 },
    classifyKind: { mode: 'auto', gate: 0.8 },
  },
  rules: {
    segment: {
      headerPrefixes: ['for the '],
      splitWords: ['and', 'or'],
      splitMarks: [',', '/'],
    },
    classify: {
      unquantifiedPhrases: ['to taste', 'to serve', 'for frying', 'for greasing'],
      quantityWords: [
        'a',
        'an',
        'one',
        'two',
        'three',
        'four',
        'five',
        'six',
        'seven',
        'eight',
        'nine',
        'ten',
        'eleven',
        'twelve',
        'half',
        'quarter',
        'dozen',
        'few',
        'couple',
      ],
      notIngredientResidues: ['water', 'ice', 'ice cube', 'ice cubes'],
      notIngredientIgnoredWords: [
        // amounts and fillers
        'a',
        'an',
        'of',
        'some',
        'about',
        'approx',
        'approximately',
        'around',
        'enough',
        'to',
        'cover',
        'little',
        'extra',
        'more',
        'plus',
        'splash',
        'dash',
        'drop',
        'drops',
        'handful',
        'glass',
        'jug',
        // units
        'ml',
        'l',
        'litre',
        'litres',
        'liter',
        'liters',
        'cup',
        'cups',
        'tbsp',
        'tsp',
        'tablespoon',
        'tablespoons',
        'teaspoon',
        'teaspoons',
        'pint',
        'pints',
        'fl',
        'oz',
        // temperature and state
        'boiling',
        'boiled',
        'freshly',
        'just',
        'cold',
        'hot',
        'warm',
        'lukewarm',
        'tepid',
        'iced',
        'chilled',
        'tap',
        'crushed',
      ],
    },
  },
}

export const packageVersion: string = packageJson.version

/**
 * The engine version: the package version plus a hash of the configuration.
 * Any change to any configuration value is a new engine version.
 */
export function engineVersion(config: EngineConfig, version: string = packageVersion): string {
  const hash = createHash('sha256').update(canonicalJson(config)).digest('hex')
  return `${version}+${hash.slice(0, 16)}`
}

/** JSON with object keys sorted, so equal configs hash equally whatever their key order. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}
