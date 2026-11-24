import { describe, expect, it } from 'vitest'
import { defaultConfig, engineVersion, type ClefClient, type ClefRequest } from '../index.ts'
import { testDeps } from '../testing.ts'
import { formatReport, GoldenSet, runGolden, type FieldScore } from './index.ts'

const fields = (overrides: Record<string, unknown> = {}) => ({
  quantity: null,
  unit: null,
  size: null,
  ingredient: null,
  prep: null,
  note: null,
  ...overrides,
})

const golden = GoldenSet.parse({
  lines: [
    { id: 'D1', line: 'For the sauce:', source: 'example.com', role: 'header' },
    { id: 'D2', line: 'Marinade', source: 'example.com', role: 'header' },
    {
      id: 'D3',
      line: '1½ tsp &amp; ground cumin',
      source: 'example.com',
      role: 'ingredient',
      compound: 'single',
      kind: 'quantified',
      fields: fields({ quantity: '1½', unit: 'tsp', ingredient: ['ground cumin', 'cumin'] }),
    },
    // Labelled a note, but it starts with a number: the role rule gets it wrong.
    { id: 'D4', line: '4 servings', source: 'example.com', role: 'note' },
    {
      id: 'H1',
      line: 'Held-out line',
      source: 'example.com',
      role: 'note',
      set: 'heldout',
      recipe: 'R9',
      capture: 'manual',
    },
    {
      id: 'H2',
      line: '3 held-out eggs',
      source: 'example.com',
      role: 'note',
      set: 'heldout',
      recipe: 'R9',
      capture: 'manual',
    },
  ],
  recipes: [],
})

function score(report: { fields: FieldScore[] }, field: string): FieldScore {
  const found = report.fields.find((f) => f.field === field)
  if (!found) throw new Error(`no score for ${field}`)
  return found
}

describe('golden harness', () => {
  it('scores each field per stage: right, wrong and unknown, with the source of each answer', async () => {
    const report = await runGolden(golden, 'dev', testDeps())

    expect(report.lines).toBe(4)
    expect(score(report, 'segment.role')).toMatchObject({
      n: 4,
      correct: 2,
      wrong: 1,
      unknown: 1,
      bySource: { rule: 3 },
    })
    expect(score(report, 'segment.structure')).toMatchObject({
      n: 1,
      correct: 1,
      wrong: 0,
      unknown: 0,
    })
    expect(score(report, 'classify.kind')).toMatchObject({ n: 1, correct: 0, wrong: 0, unknown: 1 })
    // Later stages are still stubs: scored, all unknown, so their numbers move as they land.
    expect(score(report, 'extract.quantity')).toMatchObject({ n: 1, correct: 0, unknown: 1 })
    expect(score(report, 'extract.ingredient')).toMatchObject({ n: 1, correct: 0, unknown: 1 })
  })

  it('scores normalise on every golden span surviving it and mapping back to the original', async () => {
    const report = await runGolden(golden, 'dev', testDeps())
    expect(score(report, 'normalise.spans')).toMatchObject({ n: 1, correct: 1, wrong: 0 })
  })

  it('finds a golden span at any of its places in the line, not only the first', async () => {
    // The first "2" in the normalised line is part of the "1/2" that "½" became.
    const repeated = GoldenSet.parse({
      lines: [
        {
          id: 'D5',
          line: '½ lime, cut into 2',
          source: 'example.com',
          role: 'ingredient',
          compound: 'single',
          kind: 'quantified',
          fields: fields({ quantity: '½', ingredient: 'lime', prep: 'cut into', note: '2' }),
        },
      ],
      recipes: [],
    })
    const report = await runGolden(repeated, 'dev', testDeps())
    expect(score(report, 'normalise.spans')).toMatchObject({ n: 1, correct: 1, wrong: 0 })
  })

  it('lists the dev misses, but only counts held-out ones', async () => {
    const dev = await runGolden(golden, 'dev', testDeps())
    expect(dev.misses).toEqual([
      { id: 'D4', field: 'segment.role', expected: 'note', got: 'ingredient', source: 'rule' },
    ])

    const heldout = await runGolden(golden, 'heldout', testDeps())
    expect(score(heldout, 'segment.role')).toMatchObject({ n: 2, wrong: 1 })
    expect(heldout.misses).toBeNull()
  })

  it('sends Clef nothing but dev lines in dev mode', async () => {
    const asked: ClefRequest[] = []
    const clef: ClefClient = {
      ask: (request) => {
        asked.push(request)
        return Promise.reject(new Error('offline'))
      },
    }
    await runGolden(golden, 'dev', testDeps({ clef }))

    expect(asked.map((r) => r.state['line'])).toEqual([
      'Marinade',
      '1½ tsp &amp; ground cumin',
      '4 servings',
    ])
  })

  it('records the engine version, model id, answer fingerprint and confidence formula', async () => {
    const report = await runGolden(golden, 'dev', testDeps())
    expect(report.engine).toEqual({
      version: engineVersion(defaultConfig),
      modelId: '@cf/cloudflare/clef',
      answerFingerprint: null,
      confidenceFormula: 'jev-normalised',
      framingVersion: 'v2',
    })

    const text = formatReport(report)
    expect(text).toContain('@cf/cloudflare/clef')
    expect(text).toContain('jev-normalised')
    expect(text).toContain('| segment.role | 4 | 2 | 1 | 1 |')
  })
})
