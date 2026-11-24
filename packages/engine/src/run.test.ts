import { describe, expect, it } from 'vitest'
import { EngineOutput, run, type ClefClient, type ClefRequest } from './index.ts'
import { sourceOf, testDeps } from './testing.ts'

/** A fake Clef answering from a script keyed by line text, recording every request. */
function scriptedClef(script: Record<string, Record<string, unknown>>) {
  const requests: ClefRequest[] = []
  const client: ClefClient = {
    ask: (request) => {
      requests.push(request)
      const answers = script[request.state['line'] as string]
      return answers ? Promise.resolve(answers) : Promise.reject(new Error('no answer scripted'))
    },
  }
  return { client, requests }
}

const answer = (choice: string, probabilities: Record<string, number>) => ({
  choice,
  probabilities,
})

describe('run', () => {
  it('reads a "For the ..." line as a header by rule, in a schema-valid output', async () => {
    const output = await run(sourceOf(['For the sauce:']), [], testDeps())

    expect(EngineOutput.parse(output)).toEqual(output)
    expect(output.lines[0]?.role).toEqual({ source: 'rule', value: 'header' })
    expect(output.kbVersion).toBe('kb-test')
    expect(output.runStatus).toBe('complete')
  })

  it('does not ask Clef about a line the rules settle', async () => {
    const clef = scriptedClef({})
    const output = await run(sourceOf(['For the sauce:']), [], testDeps({ clef: clef.client }))

    expect(clef.requests).toEqual([])
    expect(output.runStatus).toBe('complete')
  })

  it('asks Clef, in one request per line, only the questions no rule settled', async () => {
    const clef = scriptedClef({
      'Salt and pepper': {
        role: answer('ingredient', { header: 0.01, ingredient: 0.98, note: 0.01 }),
        compound: answer('compound', { single: 0.01, compound: 0.98, alternatives: 0.01 }),
        kind: answer('unquantified', {
          quantified: 0.01,
          unquantified: 0.98,
          not_ingredient: 0.01,
        }),
      },
    })
    await run(sourceOf(['Salt and pepper', 'For the sauce:']), [], testDeps({ clef: clef.client }))

    expect(clef.requests).toHaveLength(1)
    const [request] = clef.requests
    expect(request?.state).toEqual({ line: 'Salt and pepper' })
    expect(Object.keys(request?.questions ?? {})).toEqual(['role', 'compound', 'kind'])
    expect(request?.questions['role']).toEqual({
      type: 'choice',
      instructions: "What kind of line is `line` in a recipe's ingredient list?",
      // The v2 framing, unchanged from docs/ideation/research/jev-spike/run_spike.py.
      criteria: {
        header:
          "A section heading inside the ingredient list, such as 'For the dressing:'. Names no ingredient to buy.",
        ingredient: 'Names a food or drink item used in the recipe, with or without an amount.',
        note: 'A remark, tip, serving count or instruction that names no ingredient to buy.',
      },
    })
  })

  it('accepts an auto question at or above its gate silently, with its own confidence', async () => {
    const clef = scriptedClef({
      Marinade: {
        // The provider's own confidence field is never read.
        role: {
          ...answer('header', { header: 0.9, ingredient: 0.07, note: 0.03 }),
          confidence: 0.1,
        },
        kind: answer('quantified', { quantified: 0.4, unquantified: 0.3, not_ingredient: 0.3 }),
      },
    })
    const output = await run(sourceOf(['Marinade']), [], testDeps({ clef: clef.client }))

    expect(output.lines[0]?.role).toEqual({
      source: 'model',
      value: 'header',
      answer: 'header',
      // (p_max - 1/n) / (1 - 1/n) with p_max 0.9 over 3 options
      confidence: expect.closeTo(0.85, 9) as unknown,
      alternatives: [
        { value: 'ingredient', probability: 0.07 },
        { value: 'note', probability: 0.03 },
      ],
    })
    // A header has no parts, so the kind Clef was asked alongside is dropped, unflagged.
    expect(output.lines[0]?.parts).toEqual([])
    expect(output.flags).toEqual([])
    expect(output.runStatus).toBe('complete')
  })

  it('applies an auto answer below its gate and flags it low_confidence', async () => {
    const clef = scriptedClef({
      'freshly ground black pepper': {
        role: answer('ingredient', { header: 0.01, ingredient: 0.98, note: 0.01 }),
        kind: answer('unquantified', { quantified: 0.35, unquantified: 0.6, not_ingredient: 0.05 }),
      },
    })
    const output = await run(
      sourceOf(['freshly ground black pepper']),
      [],
      testDeps({ clef: clef.client }),
    )

    expect(output.lines[0]?.parts[0]?.kind).toMatchObject({
      source: 'model',
      value: 'unquantified',
    })
    expect(output.flags).toEqual([
      {
        target: { scope: 'line', lineIndex: 0, partIndex: 0, field: 'kind' },
        code: 'low_confidence',
        severity: 'check',
        answer: 'unquantified',
        alternatives: [
          { value: 'quantified', probability: 0.35 },
          { value: 'not_ingredient', probability: 0.05 },
        ],
      },
    ])
  })

  it('applies and flags a review-first answer whatever its confidence', async () => {
    const clef = scriptedClef({
      '2 red onions, finely chopped': {
        compound: answer('single', { single: 1, compound: 0, alternatives: 0 }),
        kind: answer('quantified', { quantified: 1, unquantified: 0, not_ingredient: 0 }),
      },
    })
    const output = await run(
      sourceOf(['2 red onions, finely chopped']),
      [],
      testDeps({ clef: clef.client }),
    )

    expect(output.lines[0]?.split).toMatchObject({
      source: 'model',
      value: 'single',
      confidence: 1,
    })
    expect(output.flags).toEqual([
      {
        target: { scope: 'line', lineIndex: 0, partIndex: 0, field: 'split' },
        code: 'review_first',
        severity: 'check',
        answer: 'single',
        alternatives: [
          { value: 'compound', probability: 0 },
          { value: 'alternatives', probability: 0 },
        ],
      },
    ])
  })

  it.each([
    ['Clef is unavailable', {}],
    [
      'Clef answers with an option it was not offered',
      {
        Marinade: {
          role: answer('recipe', { recipe: 1 }),
          kind: answer('quantified', { quantified: 1 }),
        },
      },
    ],
    [
      'Clef leaves a question unanswered',
      { Marinade: { kind: answer('quantified', { quantified: 1 }) } },
    ],
  ])(
    'keeps rule decisions and runs partial, with no line flags, when %s',
    async (_name, script) => {
      const clef = scriptedClef({
        ...script,
        '2 red onions, finely chopped': {
          compound: answer('single', { single: 1, compound: 0, alternatives: 0 }),
          kind: answer('quantified', { quantified: 1, unquantified: 0, not_ingredient: 0 }),
        },
      })
      const output = await run(
        sourceOf(['Marinade', '2 red onions, finely chopped', 'For the sauce:']),
        [],
        testDeps({ clef: clef.client }),
      )

      expect(output.runStatus).toBe('partial')
      expect(output.flags).toEqual([])
      expect(output.lines.map((l) => l.role)).toEqual([
        { source: null, value: null },
        { source: 'rule', value: 'ingredient' },
        { source: 'rule', value: 'header' },
      ])
      expect(output.lines[1]?.split).toEqual({ source: null, value: null })
    },
  )
})
