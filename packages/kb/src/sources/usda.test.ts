import { describe, expect, it } from 'vitest'
import { usdaFiles } from '../testing/fixtures.ts'
import { parseUsda } from './usda.ts'

describe('parseUsda', () => {
  const foods = parseUsda(usdaFiles)

  it('reads item weights per single item, dropping weight units and prep-specific rows', () => {
    expect(foods.get('170000')?.itemWeights).toEqual([
      { name: 'large', grams: 150 },
      { name: 'medium', grams: 110 },
      { name: 'small', grams: 70 },
      { name: 'rings', grams: 6 },
    ])
  })

  it('derives a density from the level cup, preferring cup to tablespoon to teaspoon', () => {
    // 113 g per US cup (236.588 ml).
    expect(foods.get('171000')?.density?.gramsPerMl).toBeCloseTo(113 / 236.588, 5)
    expect(foods.get('171000')?.density?.basis).toBe('cup')
  })

  it('has no density when only prep-specific cups exist', () => {
    expect(foods.get('170000')?.density).toBeUndefined()
  })

  it('names item weights from the measure unit when the modifier is empty', () => {
    expect(foods.get('171000')?.itemWeights).toEqual([
      { name: 'slice', grams: 28 },
      { name: 'can', grams: 190 },
    ])
  })
})
