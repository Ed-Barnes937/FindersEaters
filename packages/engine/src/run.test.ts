import { describe, expect, it } from 'vitest'
import {
  defaultConfig,
  EngineOutput,
  run,
  type ClefClient,
  type EngineDeps,
  type SourceDocument,
} from './index.ts'

const unavailableClef: ClefClient = {
  ask: () => Promise.reject(new Error('Clef unavailable')),
}

function deps(overrides: Partial<EngineDeps> = {}): EngineDeps {
  return { kb: { version: 'kb-test' }, clef: unavailableClef, config: defaultConfig, ...overrides }
}

function source(ingredientLines: SourceDocument['ingredientLines']): SourceDocument {
  return {
    title: 'Test recipe',
    ingredientLines,
    method: [],
    yield: null,
    times: {},
    sourceDomain: null,
  }
}

describe('run', () => {
  it('reads a "For the ..." line as a header by rule, in a schema-valid output', async () => {
    const output = await run(source([{ text: 'For the sauce:' }]), [], deps())

    expect(EngineOutput.parse(output)).toEqual(output)
    expect(output.lines[0]?.role).toEqual({ source: 'rule', value: 'header' })
    expect(output.kbVersion).toBe('kb-test')
  })
})
