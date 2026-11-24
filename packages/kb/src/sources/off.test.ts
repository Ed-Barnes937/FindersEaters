import { describe, expect, it } from 'vitest'
import { offText } from '../testing/fixtures.ts'
import { parseOffTaxonomy } from './off.ts'

describe('parseOffTaxonomy', () => {
  const entries = parseOffTaxonomy(offText)
  const byId = new Map(entries.map((e) => [e.id, e]))

  it('keeps entries that have an English name and skips the rest', () => {
    expect(byId.has('en:onion')).toBe(true)
    expect(entries.map((e) => e.id)).not.toContain('en:seulement-francais')
    expect(entries.every((e) => e.names.length > 0)).toBe(true)
  })

  it('does not treat the stopwords and synonyms blocks as entries', () => {
    expect(entries.map((e) => e.id)).not.toContain('en:colour')
    expect(entries.map((e) => e.id)).not.toContain('en:of')
  })

  it('takes the id from the first English name and keeps every English synonym', () => {
    expect(byId.get('en:onion')?.names).toEqual(['Onion', 'Onions', 'Bulb onion'])
    expect(byId.get('en:tomato-puree')?.names).toEqual(['Tomato puree', 'Tomato purée'])
  })

  it('records parents by id, resolved through names and synonyms', () => {
    expect(byId.get('en:red-onion')?.parents).toEqual(['en:onion'])
    expect(byId.get('en:onion')?.parents).toEqual(['en:vegetable'])
    expect(byId.get('en:vegetable')?.parents).toEqual([])
  })

  it('reads the properties the KB uses and ignores other languages', () => {
    const onion = byId.get('en:onion')
    expect(onion?.wikidataId).toBe('Q23400')
    expect(onion?.ciqualId).toBe('20034')
    expect(onion?.vegan).toBe('yes')
    expect(byId.get('en:onion-powder')?.vegetarian).toBe('maybe')
    expect(byId.get('en:wheat-flour')?.vegan).toBeUndefined()
  })

  it('drops a parent that no English entry defines and records it', () => {
    const [thing] = parseOffTaxonomy('< en: E322i\nen: Thing\n')
    expect(thing?.parents).toEqual([])
    expect(thing?.droppedParents).toEqual(['E322i'])
  })
})
