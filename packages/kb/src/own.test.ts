import { describe, expect, it } from 'vitest'
import { parseOwnLayer } from './own.ts'
import { ownFiles } from './testing/fixtures.ts'

describe('parseOwnLayer', () => {
  it('reads the YAML files by concern', () => {
    const own = parseOwnLayer(ownFiles)
    expect(own.ingredients.map((i) => i.slug)).toEqual(['plain-flour', 'bicarbonate-of-soda'])
    expect(own.names[0]).toMatchObject({ ingredient: 'tomato-concentrate', lang: 'en-gb' })
    expect(own.dietary[0]?.properties).toEqual({
      contains_meat_poultry: 'no',
      contains_gluten: 'no',
    })
    expect(own.links[0]).toEqual({ ingredient: 'onion', intake24: 'ONNS', usda: '170000' })
  })

  it('treats a missing file as empty', () => {
    expect(parseOwnLayer({}).ingredients).toEqual([])
  })

  it('rejects a file it does not know, so a typo cannot hide data', () => {
    expect(() => parseOwnLayer({ 'ingredient.yaml': '[]' })).toThrow(/ingredient\.yaml/)
  })

  it('rejects unknown fields and bad values, naming the file', () => {
    expect(() =>
      parseOwnLayer({ 'aisles.yaml': '- ingredient: onion\n  aisle: veg\n  extra: 1' }),
    ).toThrow(/aisles\.yaml/)
    expect(() =>
      parseOwnLayer({
        'dietary.yaml': "- ingredient: onion\n  properties:\n    contains_gluten: 'maybe'",
      }),
    ).toThrow(/dietary\.yaml/)
  })
})
