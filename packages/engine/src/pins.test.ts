import { describe, expect, it } from 'vitest'
import { lineHash, run, type ClefClient, type ClefRequest, type Pin } from './index.ts'
import { sourceOf, testDeps } from './testing.ts'

const LINE = 'Salt and pepper'

function recordingClef() {
  const requests: ClefRequest[] = []
  const client: ClefClient = {
    ask: (request) => {
      requests.push(request)
      return Promise.resolve({
        role: { choice: 'ingredient', probabilities: { header: 0, ingredient: 1, note: 0 } },
        compound: { choice: 'single', probabilities: { single: 1, compound: 0, alternatives: 0 } },
        kind: {
          choice: 'quantified',
          probabilities: { quantified: 1, unquantified: 0, not_ingredient: 0 },
        },
      })
    },
  }
  return { client, requests }
}

type LinePin = Extract<Pin, { scope: 'line' }>

function linePin(field: string, value: unknown, overrides: Partial<LinePin> = {}): LinePin {
  return {
    scope: 'line',
    lineIndex: 0,
    partIndex: 0,
    lineHash: lineHash(LINE),
    field,
    value,
    ...overrides,
  }
}

describe('pins', () => {
  it('decide their field before rule and Clef, unflagged, and Clef is not asked about them', async () => {
    const clef = recordingClef()
    const pins = [
      linePin('role', 'ingredient'),
      linePin('split', 'compound'),
      linePin('kind', 'unquantified'),
    ]
    const output = await run(sourceOf([LINE]), pins, testDeps({ clef: clef.client }))

    const line = output.lines[0]!
    expect(line.role).toEqual({ source: 'correction', value: 'ingredient' })
    expect(line.split).toEqual({ source: 'correction', value: 'compound' })
    expect(line.parts[0]?.kind).toEqual({ source: 'correction', value: 'unquantified' })
    expect(clef.requests).toEqual([])
    expect(output.flags).toEqual([])
  })

  it('beat a rule', async () => {
    const output = await run(
      sourceOf(['For the sauce:']),
      [{ ...linePin('role', 'note'), lineHash: lineHash('For the sauce:') }],
      testDeps(),
    )
    expect(output.lines[0]?.role).toEqual({ source: 'correction', value: 'note' })
  })

  it.each([
    [
      'the line text changed',
      linePin('kind', 'unquantified', { lineHash: lineHash('Salt & pepper') }),
    ],
    ['the line no longer has that part', linePin('kind', 'unquantified', { partIndex: 1 })],
    ['the value is not one the field takes', linePin('kind', 'a pinch')],
  ])('are kept but not applied, and flagged orphaned, when %s', async (_name, pin) => {
    const clef = recordingClef()
    const output = await run(sourceOf([LINE]), [pin], testDeps({ clef: clef.client }))

    expect(output.lines[0]?.parts[0]?.kind).toMatchObject({ source: 'model', value: 'quantified' })
    expect(output.flags).toContainEqual({
      target: { scope: 'line', lineIndex: 0, partIndex: pin.partIndex, field: 'kind' },
      code: 'orphaned_correction',
      severity: 'check',
      answer: pin.value,
      alternatives: [],
    })
  })

  it('for a stage not built yet are neither applied nor orphaned', async () => {
    const output = await run(
      sourceOf([LINE]),
      [linePin('quantity', { min: 1, max: 1 }), { scope: 'recipe', field: 'servings', value: 4 }],
      testDeps({ clef: recordingClef().client }),
    )
    expect(output.flags.filter((f) => f.code === 'orphaned_correction')).toEqual([])
  })
})
