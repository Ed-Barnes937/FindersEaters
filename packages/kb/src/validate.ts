// Validation of a built artifact (docs/spec/food-knowledge-base.md section 8):
// duplicate slugs, dangling edges, cycles in "is a", retired ingredients
// without a live replacement, vanished ingredients and broken resolution
// expectations. Returns every problem; an empty list means valid.
import type { Artifact } from './artifact.ts'
import { normaliseName } from './normalise.ts'

export interface ValidateOptions {
  /** The artifact currently loaded: nothing in it may vanish without a `replaced_by`. */
  previous?: Artifact
}

export function validateArtifact(artifact: Artifact, options: ValidateOptions = {}): string[] {
  const problems: string[] = []
  const byId = new Map(artifact.ingredients.map((i) => [i.id, i]))
  const slugOf = (id: string) => byId.get(id)?.slug ?? id

  // Identity: ids, slugs and aliases are unique.
  if (byId.size !== artifact.ingredients.length) problems.push('duplicate ingredient id')
  const claimed = new Map<string, string>()
  for (const i of artifact.ingredients) {
    for (const [slug, kind] of [
      [i.slug, 'slug'],
      ...i.slugAliases.map((a) => [a, 'alias'] as const),
    ] as const) {
      const holder = claimed.get(slug)
      if (holder !== undefined) {
        problems.push(
          holder === i.id && kind === 'alias'
            ? `ingredient "${i.slug}" lists its own slug as an alias`
            : `duplicate slug "${slug}": ${kind === 'alias' ? 'alias of' : 'slug of'} "${i.slug}" and also used by "${slugOf(holder)}" (slugs and aliases share one namespace)`,
        )
      } else claimed.set(slug, i.id)
    }
  }

  // Facts point at ingredients that exist.
  const references: [string, string][] = [
    ...artifact.names.map((n) => ['name', n.ingredient] as [string, string]),
    ...artifact.properties.map((n) => ['property', n.ingredient] as [string, string]),
    ...artifact.itemWeights.map((n) => ['item weight', n.ingredient] as [string, string]),
    ...artifact.densities.map((n) => ['density', n.ingredient] as [string, string]),
    ...artifact.packs.map((n) => ['pack', n.ingredient] as [string, string]),
    ...artifact.aisles.map((n) => ['aisle', n.ingredient] as [string, string]),
    ...artifact.proteinBranches.map((n) => ['protein branch', n.ingredient] as [string, string]),
  ]
  for (const [what, id] of references) {
    if (!byId.has(id)) problems.push(`dangling ${what}: ingredient ${id} is not in the artifact`)
  }

  // Edges: both ends exist and are live.
  for (const e of artifact.edges) {
    for (const [end, id] of [
      ['child', e.child],
      ['parent', e.parent],
    ] as const) {
      const ingredient = byId.get(id)
      if (!ingredient) problems.push(`dangling edge: ${end} ${id} is not in the artifact`)
      else if (ingredient.retired) problems.push(`edge ${end} "${ingredient.slug}" is retired`)
    }
  }

  // "Is a" must be acyclic: trim nodes with no parents or no children until only cycles remain.
  const parents = new Map<string, Set<string>>()
  const children = new Map<string, Set<string>>()
  for (const e of artifact.edges) {
    if (e.kind !== 'is_a' || !byId.has(e.child) || !byId.has(e.parent)) continue
    parents.set(e.child, (parents.get(e.child) ?? new Set()).add(e.parent))
    children.set(e.parent, (children.get(e.parent) ?? new Set()).add(e.child))
  }
  const remaining = new Set([...parents.keys(), ...children.keys()])
  for (let changed = true; changed;) {
    changed = false
    for (const node of [...remaining]) {
      const up = [...(parents.get(node) ?? [])].filter((p) => remaining.has(p))
      const down = [...(children.get(node) ?? [])].filter((c) => remaining.has(c))
      if (up.length === 0 || down.length === 0) {
        remaining.delete(node)
        changed = true
      }
    }
  }
  if (remaining.size > 0) {
    problems.push(
      `cycle in the "is a" graph through: ${[...remaining].map(slugOf).sort().join(', ')}`,
    )
  }

  // Retired ingredients point at an ingredient that exists.
  for (const i of artifact.ingredients) {
    if (i.replacedBy !== null && !byId.has(i.replacedBy)) {
      problems.push(
        `retired ingredient "${i.slug}" has a replacement ${i.replacedBy} that is not in the artifact`,
      )
    }
  }

  // Resolution expectations (the known UK clashes): the best-ranked name wins.
  const live = new Set(artifact.ingredients.filter((i) => !i.retired).map((i) => i.id))
  for (const x of artifact.expectations) {
    const wanted = normaliseName(x.name)
    const matches = artifact.names.filter((n) => n.normalised === wanted && live.has(n.ingredient))
    const best = Math.min(...matches.map((m) => m.rank))
    const winners = [
      ...new Set(matches.filter((m) => m.rank === best).map((m) => slugOf(m.ingredient))),
    ].sort()
    if (winners.length !== 1 || winners[0] !== x.slug) {
      problems.push(
        `resolution expectation broken: "${x.name}" should resolve to ${x.slug} but resolves to ${winners.join(' or ') || 'nothing'}`,
      )
    }
  }

  // Nothing that was loaded may vanish without a `replaced_by`.
  if (options.previous) {
    const next = new Map(artifact.ingredients.map((i) => [i.id, i]))
    for (const old of options.previous.ingredients) {
      if (old.retired) continue
      const now = next.get(old.id)
      if (!now || (now.retired && now.replacedBy === null)) {
        problems.push(`ingredient "${old.slug}" would vanish without a replaced_by`)
      }
    }
  }

  return problems
}
