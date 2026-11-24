import { describe, expect, it } from 'vitest'
import { intake24Xml } from '../testing/fixtures.ts'
import { parseIntake24 } from './intake24.ts'

describe('parseIntake24', () => {
  const foods = parseIntake24(intake24Xml)

  it('reads standard-portion item weights by food code', () => {
    expect(foods.get('ONNS')?.weights).toEqual([
      { name: 'small onions', grams: 60 },
      { name: 'medium onions', grams: 150 },
      { name: 'large onions', grams: 240 },
    ])
    expect(foods.get('CHBR')?.weights).toEqual([{ name: 'fillets', grams: 120 }])
  })

  it('leaves out spoon weights, which are serving estimates, not densities', () => {
    const names = foods.get('ONNS')?.weights.map((w) => w.name)
    expect(names).not.toContain('tablespoons')
  })

  it('ignores portion methods that are not standard portions', () => {
    expect(foods.get('ONNS')?.weights).toHaveLength(3)
  })
})
