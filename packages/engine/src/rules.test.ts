import { describe, expect, it } from 'vitest'
import { run, type SourceLine } from './index.ts'
import { sourceOf, testDeps } from './testing.ts'

async function lineOf(line: string | SourceLine) {
  const output = await run(sourceOf([line]), [], testDeps())
  return output.lines[0]!
}

describe('segment: role by rule', () => {
  it.each([
    ['a captured heading', { text: 'Sauce', heading: true }, 'header'],
    ['a trailing colon', 'Marinade:', 'header'],
    ['a "For the ..." line', 'FOR THE TOPPING', 'header'],
    ['a line starting with a number', '200g basmati rice', 'ingredient'],
    ['a line starting with a vulgar fraction', '½ tsp chilli flakes', 'ingredient'],
  ] as const)('%s', async (_name, line, role) => {
    expect((await lineOf(line)).role).toEqual({ source: 'rule', value: role })
  })

  it('leaves a line no rule settles to Clef', async () => {
    expect((await lineOf('Marinade')).role).toEqual({ source: null, value: null })
  })

  it('gives a header no structure and no parts', async () => {
    const line = await lineOf('For the sauce:')
    expect(line.split).toBeNull()
    expect(line.parts).toEqual([])
  })
})

describe('segment: structure by rule', () => {
  it('reads a line with no split point as single', async () => {
    expect((await lineOf('200g basmati rice')).split).toEqual({ source: 'rule', value: 'single' })
  })

  it.each([
    ['and', 'Salt and pepper'],
    ['or', 'butter or margarine'],
    ['a comma', '2 red onions, finely chopped'],
    ['a slash', '250g/9oz spaghetti'],
  ])('leaves a line with %s to Clef', async (_name, text) => {
    expect((await lineOf(text)).split).toEqual({ source: null, value: null })
  })

  it('does not see a fraction as a split point', async () => {
    expect((await lineOf('1½ tsp ground cumin')).split).toEqual({ source: 'rule', value: 'single' })
  })

  it('does not see a split word inside another word', async () => {
    expect((await lineOf('1 tbsp brandy')).split).toEqual({ source: 'rule', value: 'single' })
  })
})

describe('classify line kind by rule', () => {
  it.each([
    ['salt, to taste', 'unquantified'],
    ['Olive oil, for frying', 'unquantified'],
    ['butter or margarine, for greasing', 'unquantified'],
    ['Basmati rice, to serve', 'unquantified'],
    ['a splash of water', 'not_ingredient'],
    ['enough cold water to cover', 'not_ingredient'],
    ['500ml boiling water', 'not_ingredient'],
    ['3/4 cup (185 ml) water', 'not_ingredient'],
    ['ice cubes', 'not_ingredient'],
  ] as const)('%s is %s', async (text, kind) => {
    expect((await lineOf(text)).parts[0]?.kind).toEqual({ source: 'rule', value: kind })
  })

  it.each([
    ['a quantity token', '2 tbsp Greek yoghurt, to serve'],
    ['a vague amount', 'a pinch of salt, to taste'],
    ['no rule phrase', 'freshly ground black pepper'],
    ['water as a part of a line', '1 vegetable stock cube, crumbled into 500ml boiling water'],
    ['water that is bought', '400ml coconut water'],
    ['water in a product name', '1 can water chestnuts'],
  ])('leaves a line with %s to Clef', async (_name, text) => {
    expect((await lineOf(text)).parts[0]?.kind).toEqual({ source: null, value: null })
  })
})
