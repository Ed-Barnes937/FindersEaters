// Intake24 UK food database (legacy `foods.xml`): standard-portion item
// weights only (docs/spec/food-knowledge-base.md section 2). Spoon weights are
// serving estimates, never densities, so they are left out.
import { XMLParser } from 'fast-xml-parser'

export interface ItemWeight {
  name: string
  grams: number
}

export interface Intake24Food {
  description: string
  weights: ItemWeight[]
}

interface Param {
  '@_name': string
  '@_value': string
}
interface PortionSize {
  '@_method': string
  param?: Param[]
}
interface Food {
  '@_code': string
  '@_description': string
  'portion-size'?: PortionSize[]
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  isArray: (name) => name === 'food' || name === 'portion-size' || name === 'param',
})

export function parseIntake24(xml: string): Map<string, Intake24Food> {
  const doc = parser.parse(xml) as { foods?: { food?: Food[] } }
  const foods = new Map<string, Intake24Food>()
  for (const food of doc.foods?.food ?? []) {
    const weights: ItemWeight[] = []
    for (const portion of food['portion-size'] ?? []) {
      if (portion['@_method'] !== 'standard-portion') continue
      const params = new Map((portion.param ?? []).map((p) => [p['@_name'], p['@_value']]))
      for (const [key, value] of params) {
        const unit = /^unit(\d+)-name$/.exec(key)
        if (!unit) continue
        const name = value.replace(/_/g, ' ').trim()
        const grams = Number(params.get(`unit${unit[1]}-weight`))
        if (/spoon/i.test(name) || !Number.isFinite(grams) || grams <= 0) continue
        weights.push({ name, grams })
      }
    }
    foods.set(food['@_code'], { description: food['@_description'].trim(), weights })
  }
  return foods
}
