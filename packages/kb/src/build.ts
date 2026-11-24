// Sources plus the own layer to the KB artifact: ingredients with stable ids,
// layered facts by precedence, classified edges and the ancestor closure
// (docs/spec/food-knowledge-base.md sections 3 to 6 and 8). Pure: it reads
// parsed inputs and returns the artifact.
import {
  ARTIFACT_FORMAT,
  computeKbVersion,
  type Artifact,
  type ArtifactIngredient,
} from './artifact.ts'
import { offIngredientId, ownIngredientId } from './ids.ts'
import { normaliseName } from './normalise.ts'
import type { OwnLayer } from './own.ts'
import type { Intake24Food, ItemWeight } from './sources/intake24.ts'
import type { OffEntry } from './sources/off.ts'
import type { SourcePins } from './sources/pins.ts'
import type { UsdaFood } from './sources/usda.ts'

export interface BuildInputs {
  pins: SourcePins
  off: OffEntry[]
  intake24: Map<string, Intake24Food>
  usda: Map<string, UsdaFood>
  own: OwnLayer
}

/** The own layer or a source disagrees with itself; every problem is listed. */
export class KbBuildError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(
      `KB build failed with ${problems.length} problem${problems.length === 1 ? '' : 's'}:\n- ${problems.join('\n- ')}`,
    )
    this.name = 'KbBuildError'
    this.problems = problems
  }
}

type Source = Artifact['names'][number]['source']
type Quality = Artifact['itemWeights'][number]['quality']
type TriState = Artifact['properties'][number]['value']

/** Words that mark a child as made from its parent rather than a kind of it. */
const MADE_FROM_WORDS =
  /\b(broth|stock|sauce|paste|extract|oil|flavouring|flavoring|juice|powder)\b/

const cmp = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0)

export function buildArtifact(inputs: BuildInputs): Artifact {
  const { pins, off, intake24, usda, own } = inputs
  const problems: string[] = []

  // ---- Ingredients: OFF entries, own-layer ingredients, retired ones.
  const retiredOff = new Set(own.retired.flatMap((r) => (r.off_id ? [r.off_id] : [])))
  const live = new Map<string, ArtifactIngredient>() // by slug
  const bySlugAlias = new Map<string, string>() // old slug -> current slug
  const offBySlug = new Map<string, OffEntry>()
  const add = (ingredient: ArtifactIngredient): void => {
    if (live.has(ingredient.slug)) problems.push(`duplicate slug "${ingredient.slug}"`)
    else live.set(ingredient.slug, ingredient)
  }

  for (const e of off) {
    if (retiredOff.has(e.id)) continue
    const slug = e.id.slice('en:'.length)
    offBySlug.set(slug, e)
    add({
      id: offIngredientId(e.id),
      slug,
      slugAliases: [],
      offId: e.id,
      wikidataId: e.wikidataId ?? null,
      ciqualId: e.ciqualId ?? null,
      displayName: e.names[0]!,
      source: 'off',
      retired: false,
      replacedBy: null,
      canonical: null,
    })
  }
  const ownKeys = new Set<string>()
  for (const o of own.ingredients) {
    if (ownKeys.has(o.key)) problems.push(`duplicate own ingredient key "${o.key}"`)
    ownKeys.add(o.key)
    add({
      id: ownIngredientId(o.key),
      slug: o.slug,
      slugAliases: [...o.slug_aliases].sort(),
      offId: null,
      wikidataId: o.wikidata ?? null,
      ciqualId: null,
      displayName: o.name,
      source: 'own',
      retired: false,
      replacedBy: null,
      canonical: null,
    })
    for (const alias of o.slug_aliases) bySlugAlias.set(alias, o.slug)
  }

  const resolve = (slug: string, where: string): ArtifactIngredient | undefined => {
    const found = live.get(slug) ?? live.get(bySlugAlias.get(slug) ?? '')
    if (!found) problems.push(`${where}: no ingredient "${slug}"`)
    return found
  }

  const retiredRows: ArtifactIngredient[] = []
  for (const r of own.retired) {
    const replacement = r.replaced_by
      ? resolve(r.replaced_by, `retired.yaml ${r.slug} replaced_by`)
      : undefined
    if (live.has(r.slug)) problems.push(`duplicate slug "${r.slug}" (retired and live)`)
    retiredRows.push({
      id: r.off_id ? offIngredientId(r.off_id) : ownIngredientId(r.key!),
      slug: r.slug,
      slugAliases: [],
      offId: r.off_id ?? null,
      wikidataId: null,
      ciqualId: null,
      displayName: r.slug,
      source: r.off_id ? 'off' : 'own',
      retired: true,
      replacedBy: replacement?.id ?? null,
      canonical: null,
    })
  }

  const slugOfId = new Map<string, string>()
  for (const i of [...live.values(), ...retiredRows]) slugOfId.set(i.id, i.slug)
  const idOfOff = (offId: string) => offIngredientId(offId)
  const liveIds = new Set([...live.values()].map((i) => i.id))

  // ---- Names: own en-gb, other own, then OFF.
  const nameRows = new Map<string, Artifact['names'][number]>()
  const addName = (
    ingredient: string,
    name: string,
    lang: string,
    source: Source,
    rank: number,
  ) => {
    const key = `${ingredient}\u0000${name}\u0000${lang}`
    const existing = nameRows.get(key)
    if (!existing || rank < existing.rank) {
      nameRows.set(key, { ingredient, name, normalised: normaliseName(name), lang, source, rank })
    }
  }
  for (const i of live.values()) {
    const offEntry = offBySlug.get(i.slug)
    for (const n of offEntry?.names ?? []) addName(i.id, n, 'en', 'off', 2)
    if (i.source === 'own') addName(i.id, i.displayName, 'en-gb', 'own', 0)
  }
  const displayOverride = new Map<string, string>()
  for (const n of own.names) {
    const target = resolve(n.ingredient, 'names.yaml')
    if (!target) continue
    for (const name of n.names) addName(target.id, name, n.lang, 'own', n.lang === 'en-gb' ? 0 : 1)
    if (n.display_name) {
      displayOverride.set(target.id, n.display_name)
      addName(target.id, n.display_name, n.lang, 'own', n.lang === 'en-gb' ? 0 : 1)
    }
  }
  for (const i of live.values()) i.displayName = displayOverride.get(i.id) ?? i.displayName

  // ---- Edges: OFF parents are "is a" by default; the own layer overrides.
  const edgeMap = new Map<string, Artifact['edges'][number]>()
  const edgeKey = (child: string, parent: string) => `${child}\u0000${parent}`
  const retiredIds = new Set(retiredRows.map((r) => r.id))
  const audit: Artifact['audit'] = { candidates: [], madeFromCandidates: [] }
  for (const e of off) {
    if (retiredOff.has(e.id)) continue
    for (const name of e.droppedParents) {
      audit.candidates.push({
        fact: 'edge',
        ingredient: e.id.slice('en:'.length),
        source: 'off',
        value: `dropped parent "${name}": no English entry`,
      })
    }
    for (const parentOff of e.parents) {
      const child = idOfOff(e.id)
      const parent = idOfOff(parentOff)
      if (retiredIds.has(parent)) {
        problems.push(
          `${e.id} has parent ${parentOff}, which is retired: reparent it in edges.yaml`,
        )
        continue
      }
      if (!liveIds.has(parent)) continue
      edgeMap.set(edgeKey(child, parent), { child, parent, kind: 'is_a', source: 'off' })
    }
  }
  for (const o of own.ingredients) {
    const child = ownIngredientId(o.key)
    for (const p of o.parents) {
      const parent = resolve(p, `ingredients.yaml ${o.slug} parent`)
      if (parent)
        edgeMap.set(edgeKey(child, parent.id), {
          child,
          parent: parent.id,
          kind: 'is_a',
          source: 'own',
        })
    }
  }
  for (const op of own.edges) {
    const child = resolve(op.child, 'edges.yaml child')
    const parent = resolve(op.parent, 'edges.yaml parent')
    if (!child || !parent) continue
    const key = edgeKey(child.id, parent.id)
    const existing = edgeMap.get(key)
    if (op.op === 'add') {
      if (existing && existing.source === 'off') {
        audit.candidates.push({
          fact: 'edge',
          ingredient: child.slug,
          source: 'off',
          value: `${existing.kind} ${parent.slug}`,
        })
      }
      edgeMap.set(key, { child: child.id, parent: parent.id, kind: op.kind!, source: 'own' })
    } else if (!existing) {
      problems.push(`edges.yaml: cannot ${op.op} ${child.slug} -> ${parent.slug}: no such edge`)
    } else {
      if (existing.source === 'off') {
        audit.candidates.push({
          fact: 'edge',
          ingredient: child.slug,
          source: 'off',
          value: `${existing.kind} ${parent.slug}`,
        })
      }
      if (op.op === 'remove') edgeMap.delete(key)
      else edgeMap.set(key, { ...existing, kind: op.kind!, source: 'own' })
    }
  }
  for (const e of edgeMap.values()) {
    if (e.source !== 'off' || e.kind !== 'is_a') continue
    const child = slugOfId.get(e.child)!
    const parent = slugOfId.get(e.parent)!
    const parentName = normaliseName(offBySlug.get(parent)?.names[0] ?? parent)
    for (const n of offBySlug.get(child)?.names ?? []) {
      const norm = normaliseName(n)
      const word = MADE_FROM_WORDS.exec(norm)
      if (word && norm.includes(parentName)) {
        audit.madeFromCandidates.push({ child, parent, keyword: word[1]! })
        break
      }
    }
  }
  const edges = [...edgeMap.values()].sort(
    (a, b) => cmp(a.child, b.child) || cmp(a.parent, b.parent),
  )

  // ---- Ancestor closure over "is a" edges, self included.
  const isAParents = new Map<string, string[]>()
  for (const e of edges) {
    if (e.kind === 'is_a') isAParents.set(e.child, [...(isAParents.get(e.child) ?? []), e.parent])
  }
  const ancestors: Artifact['ancestors'] = []
  for (const i of live.values()) {
    const seen = new Set([i.id])
    const stack = [i.id]
    while (stack.length > 0) {
      for (const parent of isAParents.get(stack.pop()!) ?? []) {
        if (!seen.has(parent)) {
          seen.add(parent)
          stack.push(parent)
        }
      }
    }
    for (const a of seen) ancestors.push({ node: i.id, ancestor: a })
  }
  ancestors.sort((a, b) => cmp(a.node, b.node) || cmp(a.ancestor, b.ancestor))

  // ---- Dietary properties: own > OFF vegan and vegetarian.
  const propRows = new Map<string, Artifact['properties'][number]>()
  const setProp = (ingredient: string, property: string, value: TriState, source: Source) =>
    propRows.set(`${ingredient}\u0000${property}`, { ingredient, property, value, source })
  for (const [slug, e] of offBySlug) {
    const id = live.get(slug)!.id
    if (e.vegan === 'yes') {
      setProp(id, 'contains_meat_poultry', 'no', 'off')
      setProp(id, 'contains_fish_shellfish', 'no', 'off')
      setProp(id, 'contains_other_animal_product', 'no', 'off')
    } else if (e.vegetarian === 'yes') {
      setProp(id, 'contains_meat_poultry', 'no', 'off')
      setProp(id, 'contains_fish_shellfish', 'no', 'off')
      if (e.vegan === 'no') setProp(id, 'contains_other_animal_product', 'yes', 'off')
    }
  }
  for (const d of own.dietary) {
    const target = resolve(d.ingredient, 'dietary.yaml')
    if (!target) continue
    for (const [property, value] of Object.entries(d.properties)) {
      const loser = propRows.get(`${target.id}\u0000${property}`)
      if (loser && loser.value !== value) {
        audit.candidates.push({
          fact: 'property',
          ingredient: target.slug,
          source: 'off',
          value: `${property}=${loser.value}`,
        })
      }
      setProp(target.id, property, value, 'own')
    }
  }

  // ---- Conversions: item weights own > intake24 > usda; density own > usda.
  const itemWeights: Artifact['itemWeights'] = []
  const densities: Artifact['densities'] = []
  const measuresBy = new Map<string, OwnLayer['measures'][number]>()
  for (const m of own.measures) {
    const target = resolve(m.ingredient, 'measures.yaml')
    if (!target) continue
    if (measuresBy.has(target.id))
      problems.push(`measures.yaml: duplicate entry for ${target.slug}`)
    measuresBy.set(target.id, m)
    if (m.canonical) {
      target.canonical = {
        dimension: m.canonical.dimension,
        itemName: m.canonical.item_name ?? null,
        defaultSize: m.canonical.default_size ?? null,
        setBy: m.canonical.set_by,
      }
    }
  }
  const linksBy = new Map<string, OwnLayer['links'][number]>()
  for (const l of own.links) {
    const target = resolve(l.ingredient, 'links.yaml')
    if (!target) continue
    linksBy.set(target.id, l)
    if (l.intake24 && !intake24.has(l.intake24)) {
      problems.push(
        `links.yaml: ${target.slug} links Intake24 food "${l.intake24}", which the pinned source does not contain`,
      )
    }
    if (l.usda && !usda.has(l.usda)) {
      problems.push(
        `links.yaml: ${target.slug} links USDA food "${l.usda}", which the pinned source does not contain`,
      )
    }
  }
  const asDefault = (weights: ItemWeight[]): string | undefined =>
    (weights.find((w) => /\bmedium\b/.test(w.name)) ?? weights[0])?.name
  const describeSet = (weights: { name: string; grams: number }[]) =>
    weights.map((w) => `${w.name}=${w.grams}`).join('; ')
  for (const i of live.values()) {
    const m = measuresBy.get(i.id)
    const link = linksBy.get(i.id)
    const sets: {
      source: Source
      quality: (w: ItemWeight) => Quality
      weights: (ItemWeight & { default?: boolean })[]
      quals?: Map<string, Quality>
    }[] = []
    if (m?.item_weights?.length) {
      const quals = new Map(m.item_weights.map((w) => [w.name, w.quality]))
      sets.push({ source: 'own', quality: (w) => quals.get(w.name)!, weights: m.item_weights })
    }
    const i24 = link?.intake24 ? intake24.get(link.intake24)?.weights : undefined
    if (i24?.length) sets.push({ source: 'intake24', quality: () => 'source', weights: i24 })
    const us = link?.usda ? usda.get(link.usda)?.itemWeights : undefined
    if (us?.length) sets.push({ source: 'usda', quality: () => 'source', weights: us })
    const [winner, ...losers] = sets
    if (winner) {
      const ownDefault = winner.weights.find((w) => w.default)?.name
      const defaultName = ownDefault ?? asDefault(winner.weights)
      for (const w of winner.weights) {
        itemWeights.push({
          ingredient: i.id,
          name: w.name,
          grams: w.grams,
          isDefault: w.name === defaultName,
          source: winner.source,
          quality: winner.quality(w),
        })
      }
      if (winner.weights.filter((w) => w.default).length > 1) {
        problems.push(`measures.yaml: ${i.slug} has more than one default item weight`)
      }
    }
    for (const loser of losers) {
      audit.candidates.push({
        fact: 'itemWeight',
        ingredient: i.slug,
        source: loser.source,
        value: describeSet(loser.weights),
      })
    }

    const usdaDensity = link?.usda ? usda.get(link.usda)?.density : undefined
    if (m?.density) {
      densities.push({
        ingredient: i.id,
        gramsPerMl: m.density.g_per_ml,
        source: 'own',
        quality: m.density.quality,
      })
      if (usdaDensity) {
        audit.candidates.push({
          fact: 'density',
          ingredient: i.slug,
          source: 'usda',
          value: String(usdaDensity.gramsPerMl),
        })
      }
    } else if (usdaDensity) {
      densities.push({
        ingredient: i.id,
        gramsPerMl: usdaDensity.gramsPerMl,
        source: 'usda',
        quality: 'source',
      })
    }
  }

  // ---- Packs, aisles and protein branches are own-layer only.
  const packs: Artifact['packs'] = []
  for (const p of own.packs) {
    const target = resolve(p.ingredient, 'packs.yaml')
    if (target)
      packs.push({
        ingredient: target.id,
        noun: p.noun,
        amount: p.amount,
        unit: p.unit,
        source: 'own',
        quality: p.quality,
      })
  }
  const aisles: Artifact['aisles'] = []
  for (const a of own.aisles) {
    const target = resolve(a.ingredient, 'aisles.yaml')
    if (target) aisles.push({ ingredient: target.id, aisle: a.aisle, source: 'own' })
  }
  const proteinBranches: Artifact['proteinBranches'] = []
  for (const b of own.proteinBranches) {
    for (const node of b.nodes) {
      const target = resolve(node, `protein-branches.yaml ${b.protein}`)
      if (target) proteinBranches.push({ protein: b.protein, ingredient: target.id })
    }
  }

  if (problems.length > 0) throw new KbBuildError(problems)

  const ingredients = [...live.values(), ...retiredRows].sort((a, b) => cmp(a.slug, b.slug))
  const body: Omit<Artifact, 'kbVersion'> = {
    format: ARTIFACT_FORMAT,
    sources: pins,
    ingredients,
    names: [...nameRows.values()].sort(
      (a, b) =>
        cmp(a.ingredient, b.ingredient) ||
        cmp(a.rank, b.rank) ||
        cmp(a.name, b.name) ||
        cmp(a.lang, b.lang),
    ),
    edges,
    ancestors,
    properties: [...propRows.values()].sort(
      (a, b) => cmp(a.ingredient, b.ingredient) || cmp(a.property, b.property),
    ),
    itemWeights: itemWeights.sort((a, b) => cmp(a.ingredient, b.ingredient) || cmp(a.name, b.name)),
    densities: densities.sort((a, b) => cmp(a.ingredient, b.ingredient)),
    packs: packs.sort((a, b) => cmp(a.ingredient, b.ingredient) || cmp(a.noun, b.noun)),
    aisles: aisles.sort((a, b) => cmp(a.ingredient, b.ingredient)),
    proteinBranches: proteinBranches.sort(
      (a, b) => cmp(a.protein, b.protein) || cmp(a.ingredient, b.ingredient),
    ),
    expectations: [...own.expectations].sort((a, b) => cmp(a.name, b.name)),
    audit: {
      candidates: audit.candidates.sort(
        (a, b) =>
          cmp(a.ingredient, b.ingredient) ||
          cmp(a.fact, b.fact) ||
          cmp(a.source, b.source) ||
          cmp(a.value, b.value),
      ),
      madeFromCandidates: audit.madeFromCandidates.sort(
        (a, b) => cmp(a.child, b.child) || cmp(a.parent, b.parent),
      ),
    },
  }
  return { ...body, kbVersion: computeKbVersion(body) }
}
