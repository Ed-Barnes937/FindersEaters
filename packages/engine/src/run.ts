import type { ClefClient } from './clef.ts'
import { engineVersion, type EngineConfig } from './config.ts'
import type { EngineOutput, Line } from './output.ts'
import type { SourceDocument } from './source.ts'
import { normalise } from './normalise.ts'

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

const unknown = { source: null, value: null } as const

/**
 * The engine: original text in, engine output out. Pure apart from the Clef
 * port it is handed; it does no I/O of its own.
 */
export async function run(
  input: SourceDocument,
  _pins: unknown[],
  deps: EngineDeps,
): Promise<EngineOutput> {
  const lines: Line[] = input.ingredientLines.map((line, index) => {
    const normalised = normalise(line.text)
    return {
      index,
      normalised: normalised.text,
      offsets: normalised.offsets,
      role: /^for the /i.test(normalised.text) ? { source: 'rule', value: 'header' } : unknown,
      split: null,
      parts: [],
    }
  })
  return Promise.resolve({
    engineVersion: engineVersion(deps.config),
    kbVersion: deps.kb.version,
    runStatus: 'complete',
    lines,
    recipe: {
      title: unknown,
      yield: unknown,
      totalTime: unknown,
      unitSystem: unknown,
      tags: unknown,
    },
    flags: [],
  })
}
