import { describe, expect, it } from 'vitest'
import { buildArtifact, KbBuildError } from './build.ts'
import { offIngredientId, ownIngredientId } from './ids.ts'
import { fixtureInputs, ownFiles } from './testing/fixtures.ts'
import type { Artifact } from './artifact.ts'

function build(own: Record<string, string> = ownFiles): Artifact {
  return buildArtifact(fixtureInputs(own))
}
const ing = (a: Artifact, slug: string) => a.ingredients.find((i) => i.slug === slug)!

describe('ingredients and identity', () => {
  const a = build()

  it('imports every OFF entry with an English name, slugged by OFF id without en:', () => {
    expect(ing(a, 'onion').offId).toBe('en:onion')
    expect(ing(a, 'tomato-puree').displayName).toBe('Tomato puree')
    expect(a.ingredients.some((i) => i.slug === 'seulement-francais')).toBe(false)
  })

  it('adds own-layer ingredients with their own slug and an own-layer parent edge', () => {
    const flour = ing(a, 'plain-flour')
    expect(flour).toMatchObject({ source: 'own', offId: null, displayName: 'Plain flour' })
    expect(a.edges).toContainEqual({
      child: flour.id,
      parent: ing(a, 'wheat-flour').id,
      kind: 'is_a',
      source: 'own',
    })
  })

  it('mints stable surrogate ids from the OFF id or the own key', () => {
    expect(ing(a, 'onion').id).toBe(offIngredientId('en:onion'))
    expect(ing(a, 'plain-flour').id).toBe(ownIngredientId('plain-flour'))
    expect(offIngredientId('en:onion')).not.toBe(ownIngredientId('en:onion'))
  })

  it('rebuilding with unchanged inputs yields the same version, ids and artifact', () => {
    const b = build()
    expect(b.kbVersion).toBe(a.kbVersion)
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })

  it('changes the version when the own layer changes', () => {
    const changed = build({
      ...ownFiles,
      'aisles.yaml': '- ingredient: vegetable\n  aisle: produce',
    })
    expect(changed.kbVersion).not.toBe(a.kbVersion)
    expect(ing(changed, 'onion').id).toBe(ing(a, 'onion').id)
  })

  it('changes the version when a source pin changes', () => {
    const inputs = fixtureInputs()
    inputs.pins = { ...inputs.pins, usda: { ...inputs.pins.usda, sha256: 'f'.repeat(64) } }
    expect(buildArtifact(inputs).kbVersion).not.toBe(a.kbVersion)
  })

  it('keeps an own slug change as an alias of the old one', () => {
    const renamed = build({
      ...ownFiles,
      'ingredients.yaml': ownFiles['ingredients.yaml']!.replace(
        'slug: plain-flour',
        'slug: flour-plain\n  slug_aliases: [plain-flour]',
      ),
    })
    const flour = renamed.ingredients.find((i) => i.id === ownIngredientId('plain-flour'))!
    expect(flour.slug).toBe('flour-plain')
    expect(flour.slugAliases).toEqual(['plain-flour'])
  })
})

describe('retirement', () => {
  const retiredFiles = {
    ...ownFiles,
    'retired.yaml':
      '- slug: tomato-puree\n  off_id: en:tomato-puree\n  replaced_by: tomato-concentrate',
  }

  it('keeps a retired ingredient with its replacement and drops its facts', () => {
    const a = build(retiredFiles)
    const old = ing(a, 'tomato-puree')
    expect(old).toMatchObject({ retired: true, replacedBy: ing(a, 'tomato-concentrate').id })
    expect(old.id).toBe(offIngredientId('en:tomato-puree'))
    expect(a.names.some((n) => n.ingredient === old.id)).toBe(false)
    expect(a.edges.some((e) => e.child === old.id || e.parent === old.id)).toBe(false)
    expect(a.ancestors.some((x) => x.node === old.id)).toBe(false)
  })

  it('fails when the replacement does not exist', () => {
    expect(() =>
      build({
        ...retiredFiles,
        'retired.yaml': '- slug: tomato-puree\n  off_id: en:tomato-puree\n  replaced_by: nope',
      }),
    ).toThrow(/nope/)
  })
})

describe('edges and the ancestor closure', () => {
  const a = build()
  const id = (slug: string) => ing(a, slug).id
  const ancestorsOf = (slug: string) =>
    a.ancestors
      .filter((x) => x.node === id(slug))
      .map((x) => a.ingredients.find((i) => i.id === x.ancestor)!.slug)
      .sort()

  it('imports OFF parents as "is a" by default', () => {
    expect(a.edges).toContainEqual({
      child: id('cheddar'),
      parent: id('cheese'),
      kind: 'is_a',
      source: 'off',
    })
  })

  it('lets the own layer reclassify an edge to "made from"', () => {
    expect(a.edges).toContainEqual({
      child: id('chicken-stock'),
      parent: id('chicken'),
      kind: 'made_from',
      source: 'own',
    })
  })

  it('closes over "is a" only, self included', () => {
    expect(ancestorsOf('cheddar')).toEqual(['animal-product', 'cheddar', 'cheese', 'dairy'])
    expect(ancestorsOf('red-onion')).toEqual(['onion', 'red-onion', 'vegetable'])
    expect(ancestorsOf('chicken-stock')).toEqual(['chicken-stock'])
    expect(ancestorsOf('onion-powder')).toEqual(['onion-powder'])
  })

  it('flags unreviewed "made from" candidates by the naming rule, not own-reviewed ones', () => {
    const slugs = a.audit.madeFromCandidates.map((c) => `${c.child}>${c.parent}`)
    expect(slugs).toContain('tomato-concentrate>tomato')
    expect(slugs).not.toContain('chicken-stock>chicken')
    expect(slugs).not.toContain('cheddar>cheese')
  })

  it('applies own add, remove and reclassify, and fails on an edge that is not there', () => {
    const removed = build({
      ...ownFiles,
      'edges.yaml':
        '- child: cheddar\n  parent: cheese\n  op: remove\n- child: cheddar\n  parent: dairy\n  op: add\n  kind: is_a',
    })
    expect(removed.edges.some((e) => e.child === id('cheddar') && e.parent === id('cheese'))).toBe(
      false,
    )
    expect(removed.edges).toContainEqual({
      child: id('cheddar'),
      parent: id('dairy'),
      kind: 'is_a',
      source: 'own',
    })
    expect(() =>
      build({ ...ownFiles, 'edges.yaml': '- child: cheddar\n  parent: onion\n  op: remove' }),
    ).toThrow(KbBuildError)
  })
})

describe('own-layer references', () => {
  it('fails the build on a reference to an ingredient that does not exist', () => {
    expect(() =>
      build({ ...ownFiles, 'aisles.yaml': '- ingredient: unobtainium\n  aisle: x' }),
    ).toThrow(/unobtainium/)
  })

  it('lists every problem at once', () => {
    try {
      build({
        ...ownFiles,
        'aisles.yaml': '- ingredient: nope-one\n  aisle: x\n- ingredient: nope-two\n  aisle: y',
      })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(KbBuildError)
      expect((error as KbBuildError).problems).toHaveLength(2)
    }
  })

  it('fails on a duplicate slug between an own and an OFF ingredient', () => {
    expect(() =>
      build({ ...ownFiles, 'ingredients.yaml': '- key: x\n  slug: onion\n  name: Onion' }),
    ).toThrow(/duplicate slug.*onion/i)
  })
})

describe('names', () => {
  const a = build()
  const namesOf = (slug: string) =>
    a.names
      .filter((n) => n.ingredient === ing(a, slug).id)
      .sort((x, y) => x.rank - y.rank || x.name.localeCompare(y.name))

  it('ranks own en-gb names before other own names before OFF names', () => {
    expect(namesOf('tomato-concentrate').map((n) => [n.name, n.rank, n.source])).toEqual([
      ['tomato puree', 0, 'own'],
      ['tomato purée', 0, 'own'],
      ['Tomato purée', 0, 'own'],
      ['Tomato concentrate', 2, 'off'],
      ['Tomato paste', 2, 'off'],
    ])
  })

  it('takes the display name from the own layer first', () => {
    expect(ing(a, 'tomato-concentrate').displayName).toBe('Tomato purée')
    expect(ing(a, 'onion').displayName).toBe('Onion')
  })

  it('normalises every name for the index', () => {
    expect(namesOf('tomato-concentrate').find((n) => n.name === 'tomato purée')?.normalised).toBe(
      'tomato puree',
    )
  })
})

describe('dietary properties', () => {
  const a = build()
  const prop = (slug: string, property: string) =>
    a.properties.find((p) => p.ingredient === ing(a, slug).id && p.property === property)

  it('seeds meat, fish and other-animal from OFF vegan and vegetarian where own is silent', () => {
    expect(prop('onion', 'contains_meat_poultry')).toMatchObject({ value: 'no', source: 'off' })
    expect(prop('onion', 'contains_other_animal_product')).toMatchObject({
      value: 'no',
      source: 'off',
    })
    expect(prop('cheese', 'contains_other_animal_product')).toMatchObject({
      value: 'yes',
      source: 'off',
    })
  })

  it('maps OFF "maybe" and "no" with no further information to unknown (no row)', () => {
    expect(prop('onion-powder', 'contains_meat_poultry')).toBeUndefined()
    expect(prop('chicken-stock', 'contains_meat_poultry')).toBeUndefined()
  })

  it('lets the own layer win, and keeps the losing OFF value for audit', () => {
    expect(prop('vegetable', 'contains_meat_poultry')).toMatchObject({ value: 'no', source: 'own' })
    expect(prop('chicken', 'contains_meat_poultry')).toMatchObject({ value: 'yes', source: 'own' })
    expect(prop('vegetable', 'contains_gluten')).toMatchObject({ value: 'no', source: 'own' })
  })
})

describe('measures, packs, aisles and protein branches', () => {
  const a = build()
  const idOf = (slug: string) => ing(a, slug).id

  it('takes item weights from the highest-precedence source that has any: own > intake24 > usda', () => {
    const onion = a.itemWeights.filter((w) => w.ingredient === idOf('onion'))
    expect(onion.map((w) => [w.name, w.grams, w.source])).toEqual([
      ['large onions', 240, 'intake24'],
      ['medium onions', 150, 'intake24'],
      ['small onions', 60, 'intake24'],
    ])
    const cheddar = a.itemWeights.filter((w) => w.ingredient === idOf('cheddar'))
    expect(cheddar).toEqual([
      {
        ingredient: idOf('cheddar'),
        name: 'slice',
        grams: 25,
        isDefault: true,
        source: 'own',
        quality: 'estimate',
      },
    ])
  })

  it('marks one default size per ingredient, preferring "medium"', () => {
    const onion = a.itemWeights.filter((w) => w.ingredient === idOf('onion'))
    expect(onion.filter((w) => w.isDefault).map((w) => w.name)).toEqual(['medium onions'])
  })

  it('keeps the losing candidates for audit', () => {
    expect(a.audit.candidates).toContainEqual(
      expect.objectContaining({ fact: 'itemWeight', ingredient: 'cheddar', source: 'usda' }),
    )
    expect(a.audit.candidates).toContainEqual(
      expect.objectContaining({ fact: 'itemWeight', ingredient: 'onion', source: 'usda' }),
    )
  })

  it('takes density from own, else USDA', () => {
    expect(a.densities.find((d) => d.ingredient === idOf('chicken-breast'))).toMatchObject({
      gramsPerMl: 1.05,
      source: 'own',
      quality: 'proxy',
    })
    expect(a.densities.find((d) => d.ingredient === idOf('cheddar'))).toMatchObject({
      source: 'usda',
      quality: 'source',
    })
    expect(a.densities.some((d) => d.ingredient === idOf('onion'))).toBe(false)
  })

  it('carries the canonical measure, packs, aisles and protein branches from the own layer', () => {
    expect(ing(a, 'onion')).toMatchObject({
      canonical: { dimension: 'count', itemName: 'onion', defaultSize: 'medium', setBy: 'owner' },
    })
    expect(a.packs).toEqual([
      {
        ingredient: idOf('tomato-concentrate'),
        noun: 'tube',
        amount: 200,
        unit: 'g',
        source: 'own',
        quality: 'source',
      },
    ])
    expect(a.aisles).toContainEqual({
      ingredient: idOf('chicken-stock'),
      aisle: 'cupboard',
      source: 'own',
    })
    expect(a.proteinBranches).toEqual([{ protein: 'chicken', ingredient: idOf('chicken') }])
  })

  it('fails when a link names a food the pinned source does not contain', () => {
    expect(() =>
      build({ ...ownFiles, 'links.yaml': '- ingredient: onion\n  intake24: NOPE' }),
    ).toThrow(/NOPE/)
    expect(() => build({ ...ownFiles, 'links.yaml': "- ingredient: onion\n  usda: '1'" })).toThrow(
      /usda/i,
    )
  })
})
