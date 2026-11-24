import { describe, expect, it } from 'vitest'
import type { Artifact } from './artifact.ts'
import { buildArtifact } from './build.ts'
import { fixtureInputs } from './testing/fixtures.ts'
import { validateArtifact } from './validate.ts'

const clone = (): Artifact => structuredClone(buildArtifact(fixtureInputs()))
const id = (a: Artifact, slug: string) => a.ingredients.find((i) => i.slug === slug)!.id

describe('validateArtifact', () => {
  it('passes a clean build, including the UK-clash resolution expectations', () => {
    expect(validateArtifact(clone())).toEqual([])
  })

  it('fails on a duplicate slug', () => {
    const a = clone()
    a.ingredients[1]!.slug = a.ingredients[0]!.slug
    expect(validateArtifact(a).join('\n')).toMatch(/duplicate slug/i)
  })

  it("fails when a current slug is also another ingredient's alias", () => {
    const a = clone()
    a.ingredients[0]!.slugAliases = [a.ingredients[1]!.slug]
    expect(validateArtifact(a).join('\n')).toMatch(/alias/i)
  })

  it('fails on an edge to an ingredient that is not in the artifact', () => {
    const a = clone()
    a.edges.push({
      child: id(a, 'onion'),
      parent: '00000000-0000-5000-8000-000000000000',
      kind: 'is_a',
      source: 'own',
    })
    expect(validateArtifact(a).join('\n')).toMatch(/dangling edge/i)
  })

  it('fails on an edge to a retired ingredient', () => {
    const a = clone()
    a.ingredients.find((i) => i.slug === 'tomato')!.retired = true
    expect(validateArtifact(a).join('\n')).toMatch(/retired/i)
  })

  it('fails on a cycle in the "is a" graph, naming the members', () => {
    const a = clone()
    a.edges.push({
      child: id(a, 'vegetable'),
      parent: id(a, 'red-onion'),
      kind: 'is_a',
      source: 'own',
    })
    const problems = validateArtifact(a).join('\n')
    expect(problems).toMatch(/cycle/i)
    expect(problems).toMatch(/red-onion/)
  })

  it('ignores a cycle through "made from" edges, which only dietary derivation follows', () => {
    const a = clone()
    a.edges.push({
      child: id(a, 'vegetable'),
      parent: id(a, 'red-onion'),
      kind: 'made_from',
      source: 'own',
    })
    expect(validateArtifact(a)).toEqual([])
  })

  it('fails a retired ingredient whose replacement is missing', () => {
    const a = clone()
    const t = a.ingredients.find((i) => i.slug === 'tomato-puree')!
    t.retired = true
    t.replacedBy = '00000000-0000-5000-8000-000000000000'
    expect(validateArtifact(a).join('\n')).toMatch(/replaced_by|replacement/i)
  })

  it('fails when a resolution expectation breaks', () => {
    const a = clone()
    a.names = a.names.filter((n) => !(n.source === 'own' && n.normalised === 'tomato puree'))
    expect(validateArtifact(a).join('\n')).toMatch(/tomato purée.*tomato-concentrate/i)
  })

  it('fails when a previous artifact had an ingredient that vanished with no replaced_by', () => {
    const previous = clone()
    const next = clone()
    next.ingredients = next.ingredients.filter((i) => i.slug !== 'chicken-breast')
    expect(validateArtifact(next, { previous }).join('\n')).toMatch(/chicken-breast.*replaced_by/i)
  })
})
