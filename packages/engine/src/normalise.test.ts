import { describe, expect, it } from 'vitest'
import { defaultConfig, originalSpan, run, type ClefClient, type Line } from './index.ts'

const unavailableClef: ClefClient = { ask: () => Promise.reject(new Error('Clef unavailable')) }

async function normaliseLine(text: string): Promise<Line> {
  const output = await run(
    {
      title: 't',
      ingredientLines: [{ text }],
      method: [],
      yield: null,
      times: {},
      sourceDomain: null,
    },
    [],
    { kb: { version: 'kb' }, clef: unavailableClef, config: defaultConfig },
  )
  return output.lines[0]!
}

describe('normalise', () => {
  it.each([
    [
      'decodes named and numeric entities',
      'Salt &amp; pepper &#40;to taste&#x29;',
      'Salt & pepper (to taste)',
    ],
    ['applies NFKC', 'ﬁnely chopped parsley', 'finely chopped parsley'],
    ['composes combining marks', 'tomato purée', 'tomato purée'],
    ['writes a vulgar fraction as n/d', '½ tsp chilli flakes', '1/2 tsp chilli flakes'],
    ['writes a mixed number with a space', '1½ tsp ground cumin', '1 1/2 tsp ground cumin'],
    ['writes an entity fraction as n/d', '&frac34; cup sugar', '3/4 cup sugar'],
    ['turns a fraction slash into a slash', '1⁄2 cup milk', '1/2 cup milk'],
    ['unifies dashes', '2–3 cloves — or 4− 5', '2-3 cloves - or 4- 5'],
    ['unifies quotes', '“Mutti” tomatoes, cook’s choice', '"Mutti" tomatoes, cook\'s choice'],
    ['strips bullets', '• 200g basmati rice', '200g basmati rice'],
    ['strips a leading dash bullet', '- 2 eggs', '2 eggs'],
    ['strips list numbering', '3. 200g basmati rice', '200g basmati rice'],
    ['strips bracketed list numbering', '3) 2 eggs', '2 eggs'],
    ['keeps a decimal quantity', '1.5 kg beef brisket', '1.5 kg beef brisket'],
    ['collapses whitespace', '  3/4 cup (185 ml)   water \t', '3/4 cup (185 ml) water'],
  ])('%s', async (_name, original, expected) => {
    expect((await normaliseLine(original)).normalised).toBe(expected)
  })

  it('maps every normalised span back to the original line', async () => {
    const original = '• 1½ tsp ground cumin &amp;  coriander'
    const line = await normaliseLine(original)
    expect(line.normalised).toBe('1 1/2 tsp ground cumin & coriander')
    expect(line.offsets).toHaveLength(line.normalised.length)

    const span = (text: string) => {
      const start = line.normalised.indexOf(text)
      return originalSpan(original, line, start, start + text.length)
    }
    expect(span('1 1/2')).toBe('1½')
    expect(span('tsp')).toBe('tsp')
    expect(span('&')).toBe('&amp;')
    expect(span('ground cumin & coriander')).toBe('ground cumin &amp;  coriander')
  })
})
