// USDA FoodData Central SR Legacy (2018-04 CSV): `food_portion` rows for item
// weights and level cup, tablespoon and teaspoon weights, from which a density
// follows (docs/spec/food-knowledge-base.md sections 2 and 6).
import { parseCsv } from './csv.ts'
import type { ItemWeight } from './intake24.ts'

export interface UsdaDensity {
  gramsPerMl: number
  basis: 'cup' | 'tablespoon' | 'teaspoon'
}

export interface UsdaFood {
  description: string
  itemWeights: ItemWeight[]
  density?: UsdaDensity
}

export interface UsdaFiles {
  food: string
  portion: string
  measureUnit: string
}

/** Millilitres of a US cup, tablespoon and teaspoon. */
const ML = { cup: 236.588, tablespoon: 14.7868, teaspoon: 4.92892 } as const
const levelUnits: Record<string, keyof typeof ML> = {
  cup: 'cup',
  tablespoon: 'tablespoon',
  tbsp: 'tablespoon',
  teaspoon: 'teaspoon',
  tsp: 'teaspoon',
}
const densityOrder = ['cup', 'tablespoon', 'teaspoon'] as const
/** Volume and weight units that are not countable items. */
const notItems =
  /^(cup|tbsp|tablespoon|tsp|teaspoon|fl oz|oz|lb|g|kg|liter|milliliter|cubic inch|cubic centimeter|gallon|pint|quart)\b/
const unspecific = /refuse|yield|undetermined/

/** The unit text of a row: the measure unit, else the modifier, without parentheses. */
function label(unit: string | undefined, modifier: string): string {
  const mod = modifier
    .replace(/\s*\(.*$/, '')
    .trim()
    .toLowerCase()
  if (!unit) return mod
  return mod ? `${unit}, ${mod}` : unit
}

export function parseUsda(files: UsdaFiles): Map<string, UsdaFood> {
  const units = new Map(parseCsv(files.measureUnit).map((r) => [r.id!, r.name!.toLowerCase()]))
  const foods = new Map<string, UsdaFood>()
  for (const r of parseCsv(files.food)) {
    foods.set(r.fdc_id!, { description: r.description!, itemWeights: [] })
  }
  const densities = new Map<string, Map<(typeof densityOrder)[number], number>>()
  for (const r of parseCsv(files.portion)) {
    const food = foods.get(r.fdc_id!)
    const amount = Number(r.amount)
    const grams = Number(r.gram_weight)
    if (!food || !(amount > 0) || !(grams > 0)) continue
    const unit = r.measure_unit_id === '9999' ? undefined : units.get(r.measure_unit_id!)
    const text = label(unit, r.modifier!)
    const level = levelUnits[text]
    if (level) {
      if (level === 'cup' || level === 'tablespoon' || level === 'teaspoon') {
        const byBasis = densities.get(r.fdc_id!) ?? new Map<(typeof densityOrder)[number], number>()
        if (!byBasis.has(level)) byBasis.set(level, grams / (amount * ML[level]))
        densities.set(r.fdc_id!, byBasis)
      }
      continue
    }
    if (!text || notItems.test(text) || unspecific.test(text)) continue
    if (food.itemWeights.some((w) => w.name === text)) continue
    food.itemWeights.push({ name: text, grams: Math.round((grams / amount) * 1000) / 1000 })
  }
  for (const [id, byBasis] of densities) {
    const basis = densityOrder.find((b) => byBasis.has(b))
    if (basis) foods.get(id)!.density = { gramsPerMl: byBasis.get(basis)!, basis }
  }
  return foods
}
