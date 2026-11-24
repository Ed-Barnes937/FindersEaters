// Open Food Facts ingredients taxonomy (`ingredients.txt`): every entry with an
// English name (docs/spec/food-knowledge-base.md section 2).
import { slugify } from '../normalise.ts'

export interface OffEntry {
  /** The OFF id, `en:` plus the slug of the first English name. */
  id: string
  /** English names and synonyms, canonical first. */
  names: string[]
  /** Parent ids. Whether each is "is a" or "made from" is classified in the build. */
  parents: string[]
  /** Parents written as names that no English entry defines (language-neutral entries); not imported. */
  droppedParents: string[]
  wikidataId?: string
  ciqualId?: string
  vegan?: string
  vegetarian?: string
}

interface RawEntry {
  id: string
  names: string[]
  parentNames: string[]
  props: Map<string, string>
}

const parentLine = /^<\s*en:\s*(.+?)\s*$/
const nameLine = /^en:\s*(.+?)\s*$/
const propLine = /^([a-z0-9_]+):en:\s*(.*?)\s*$/

export function parseOffTaxonomy(text: string): OffEntry[] {
  const raw: RawEntry[] = []
  for (const block of text.split(/\r?\n\s*\r?\n/)) {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l !== '' && !l.startsWith('#'))
    if (lines.length === 0) continue
    if (/^(stopwords|synonyms):/.test(lines[0]!)) continue

    let names: string[] | undefined
    const parentNames: string[] = []
    const props = new Map<string, string>()
    for (const line of lines) {
      const parent = parentLine.exec(line)
      if (parent) {
        parentNames.push(parent[1]!)
        continue
      }
      const name = nameLine.exec(line)
      if (name) {
        names ??= name[1]!
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean)
        continue
      }
      const prop = propLine.exec(line)
      if (prop && prop[2]) props.set(prop[1]!, prop[2])
    }
    if (!names || names.length === 0) continue
    raw.push({ id: `en:${slugify(names[0]!)}`, names, parentNames, props })
  }

  // Parents are written as names, so resolve them through every English name,
  // canonical names first so a synonym never shadows another entry's own name.
  const byName = new Map<string, string>()
  for (const e of raw) byName.set(slugify(e.names[0]!), e.id)
  for (const e of raw) {
    for (const n of e.names) {
      const key = slugify(n)
      if (!byName.has(key)) byName.set(key, e.id)
    }
  }

  return raw.map((e) => {
    const parents: string[] = []
    const droppedParents: string[] = []
    for (const name of e.parentNames) {
      const id = byName.get(slugify(name))
      if (id) parents.push(id)
      else droppedParents.push(name)
    }
    const entry: OffEntry = {
      id: e.id,
      names: e.names,
      parents: [...new Set(parents)],
      droppedParents,
    }
    const set = (key: keyof OffEntry, prop: string) => {
      const value = e.props.get(prop)
      if (value) (entry as unknown as Record<string, string>)[key] = value
    }
    set('wikidataId', 'wikidata')
    set('ciqualId', 'ciqual_food_code')
    set('vegan', 'vegan')
    set('vegetarian', 'vegetarian')
    return entry
  })
}
