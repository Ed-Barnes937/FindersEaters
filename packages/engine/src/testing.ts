// Test helpers for the engine's own tests and the golden harness.
import { defaultConfig } from './config.ts'
import type { ClefClient } from './clef.ts'
import type { EngineDeps } from './run.ts'
import type { SourceDocument, SourceLine } from './source.ts'

/** A Clef that is always down: every Clef-dependent decision stays unknown. */
export const unavailableClef: ClefClient = {
  ask: () => Promise.reject(new Error('Clef unavailable')),
}

export function testDeps(overrides: Partial<EngineDeps> = {}): EngineDeps {
  return { kb: { version: 'kb-test' }, clef: unavailableClef, config: defaultConfig, ...overrides }
}

export function sourceOf(
  lines: (string | SourceLine)[],
  overrides: Partial<SourceDocument> = {},
): SourceDocument {
  return {
    title: 'Test recipe',
    ingredientLines: lines.map((l) => (typeof l === 'string' ? { text: l } : l)),
    method: [],
    yield: null,
    times: {},
    sourceDomain: null,
    ...overrides,
  }
}
