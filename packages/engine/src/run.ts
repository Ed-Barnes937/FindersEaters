import type { ClefClient, ClefQuestion, ClefRequest } from './clef.ts'
import { engineVersion, type EngineConfig } from './config.ts'
import {
  choiceQuestion,
  modelDecision,
  reviewFlag,
  unknownDecision,
  type Decided,
  type ModelDecision,
  type Settled,
} from './ladder.ts'
import {
  LineKind,
  Role,
  Split,
  type EngineOutput,
  type Flag,
  type Line,
  type Part,
} from './output.ts'
import type { SourceDocument } from './source.ts'
import { kindByRule } from './stages/classify.ts'
import { normalise, type Normalised } from './stages/normalise.ts'
import { roleByRule, splitPoints } from './stages/segment.ts'

/** A read-only snapshot of the food knowledge base. Lookups arrive with #38. */
export interface KbSnapshot {
  version: string
}

/** The engine's three ports (docs/spec/engine-pipeline.md section 1). */
export interface EngineDeps {
  kb: KbSnapshot
  clef: ClefClient
  config: EngineConfig
}

/** What the pin and rule rungs settled for one line, before Clef. */
interface Draft {
  index: number
  original: string
  normalised: Normalised
  role: Settled<Role> | null
  split: Settled<Split> | null
  kind: Settled<LineKind> | null
  /** Clef question ids this line still needs, in request order. */
  ask: LineQuestion[]
}

/** A line's Clef questions, by their v2 framing ids. */
type LineQuestion = 'role' | 'compound' | 'kind'

/** Clef's decisions for one line, by question. */
type LineAnswers = Partial<{
  role: ModelDecision<Role>
  compound: ModelDecision<Split>
  kind: ModelDecision<LineKind>
}>

/**
 * The engine: original text in, engine output out. Pure apart from the Clef
 * port it is handed; it does no I/O of its own.
 */
export async function run(
  input: SourceDocument,
  _pins: unknown[],
  deps: EngineDeps,
): Promise<EngineOutput> {
  const { config } = deps
  const drafts = input.ingredientLines.map((line, index) => draftLine(line, index, config))
  const answers = await askClef(drafts, deps.clef, config)
  const flags: Flag[] = []
  const lines = drafts.map((draft) => {
    const decided = decideLine(draft, answers?.[draft.index] ?? {})
    if (answers) flags.push(...decided.flags)
    return decided.line
  })
  return {
    engineVersion: engineVersion(config),
    kbVersion: deps.kb.version,
    runStatus: answers ? 'complete' : 'partial',
    lines,
    recipe: {
      title: unknownDecision,
      yield: unknownDecision,
      totalTime: unknownDecision,
      unitSystem: unknownDecision,
      tags: unknownDecision,
    },
    flags,
  }

  function decideLine(draft: Draft, clef: LineAnswers): { line: Line; flags: Flag[] } {
    const lineFlags: Flag[] = []
    const target = (field: string) =>
      ({ scope: 'line', lineIndex: draft.index, partIndex: 0, field }) as const
    const fromClef = <T>(
      decided: ModelDecision<T> | undefined,
      mode: keyof EngineConfig['questions'],
      field: string,
    ): Decided<T> => {
      if (!decided) return unknownDecision
      const flag = reviewFlag(decided, config.questions[mode], target(field))
      if (flag) lineFlags.push(flag)
      return decided
    }

    const role = draft.role ?? fromClef(clef.role, 'segmentRole', 'role')
    const isIngredientLine = role.value === null || role.value === 'ingredient'
    const split = isIngredientLine
      ? (draft.split ?? fromClef(clef.compound, 'segmentStructure', 'split'))
      : null
    const kind = isIngredientLine
      ? (draft.kind ?? fromClef(clef.kind, 'classifyKind', 'kind'))
      : null
    return {
      line: {
        index: draft.index,
        normalised: draft.normalised.text,
        offsets: draft.normalised.offsets,
        role,
        split,
        parts: kind ? [partOf(0, kind)] : [],
      },
      flags: lineFlags,
    }
  }
}

function draftLine(
  line: SourceDocument['ingredientLines'][number],
  index: number,
  config: EngineConfig,
): Draft {
  const { rules } = config
  const normalised = normalise(line.text)
  const settle = <T>(value: T | null): Settled<T> | null =>
    value === null ? null : { source: 'rule', value }

  const role = settle(roleByRule(line, normalised.text, rules.segment))
  const split = settle<Split>(
    splitPoints(normalised.text, rules.segment).length === 0 ? 'single' : null,
  )
  const kind = settle(kindByRule(normalised.text, rules.classify))

  const mayBeIngredientLine = role === null || role.value === 'ingredient'
  const ask: LineQuestion[] = []
  if (!role) ask.push('role')
  if (mayBeIngredientLine && !split) ask.push('compound')
  if (mayBeIngredientLine && !kind) ask.push('kind')
  return { index, original: line.text, normalised, role, split, kind, ask }
}

/**
 * One Clef request per line that still has questions, all in flight together.
 * Returns each line's decisions, or null when Clef failed or gave an unusable
 * answer: the run is then partial and every Clef-dependent decision unknown.
 */
async function askClef(
  drafts: Draft[],
  clef: ClefClient,
  config: EngineConfig,
): Promise<LineAnswers[] | null> {
  const { framing, confidenceFormula } = config
  const options = { role: Role.options, compound: Split.options, kind: LineKind.options }
  try {
    return await Promise.all(
      drafts.map(async (draft) => {
        if (draft.ask.length === 0) return {}
        const questions: Record<string, ClefQuestion> = {}
        for (const id of draft.ask) questions[id] = choiceQuestion(framing.questions[id])
        // The v2 framing's state is the line as captured (the spike sent the raw line).
        const request: ClefRequest = { state: { line: draft.original }, questions }
        const raw = await clef.ask(request)
        const answers: LineAnswers = {}
        for (const id of draft.ask) {
          // Each id is typed by its own options; the switch keeps that link.
          switch (id) {
            case 'role':
              answers.role = modelDecision(raw[id], options.role, confidenceFormula)
              break
            case 'compound':
              answers.compound = modelDecision(raw[id], options.compound, confidenceFormula)
              break
            case 'kind':
              answers.kind = modelDecision(raw[id], options.kind, confidenceFormula)
              break
          }
        }
        return answers
      }),
    )
  } catch {
    return null
  }
}

/** A part with the stages after classify still stubs: every later field unknown. */
function partOf(index: number, kind: Part['kind']): Part {
  return {
    index,
    kind,
    quantity: unknownDecision,
    unit: unknownDecision,
    size: unknownDecision,
    ingredient: unknownDecision,
    prep: unknownDecision,
    note: unknownDecision,
    optional: unknownDecision,
    resolution: unknownDecision,
    canonical: unknownDecision,
  }
}
