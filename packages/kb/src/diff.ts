// The diff report for a source bump or an own-layer change: added, retired,
// renamed, reparented, and property and measure changes
// (docs/spec/food-knowledge-base.md section 8).
import type { Artifact } from './artifact.ts'

export interface ArtifactDiff {
  added: string[]
  retired: string[]
  renamed: { from: string; to: string }[]
  reparented: { ingredient: string; from: string[]; to: string[] }[]
  propertyChanges: number
  measureChanges: number
}

const keyed = <T>(rows: T[], key: (row: T) => string) =>
  new Map(rows.map((r) => [key(r), JSON.stringify(r)]))

function changed(before: Map<string, string>, after: Map<string, string>): number {
  let n = 0
  for (const [k, v] of after) if (before.get(k) !== v) n++
  for (const k of before.keys()) if (!after.has(k)) n++
  return n
}

export function diffArtifacts(before: Artifact, after: Artifact): ArtifactDiff {
  const prev = new Map(before.ingredients.map((i) => [i.id, i]))
  const next = new Map(after.ingredients.map((i) => [i.id, i]))
  const slug = (a: Artifact) => new Map(a.ingredients.map((i) => [i.id, i.slug]))
  const [prevSlug, nextSlug] = [slug(before), slug(after)]

  const added: string[] = []
  const retired: string[] = []
  const renamed: ArtifactDiff['renamed'] = []
  for (const [id, i] of next) {
    const old = prev.get(id)
    if (!old) added.push(i.slug)
    else {
      if (i.retired && !old.retired) retired.push(i.slug)
      if (old.slug !== i.slug) renamed.push({ from: old.slug, to: i.slug })
    }
  }
  for (const [id, old] of prev) if (!next.has(id) && !old.retired) retired.push(old.slug)

  const parentsOf = (a: Artifact, slugs: Map<string, string>) => {
    const m = new Map<string, string[]>()
    for (const e of a.edges) {
      if (e.kind === 'is_a')
        m.set(e.child, [...(m.get(e.child) ?? []), slugs.get(e.parent) ?? e.parent])
    }
    return m
  }
  const [pb, pa] = [parentsOf(before, prevSlug), parentsOf(after, nextSlug)]
  const reparented: ArtifactDiff['reparented'] = []
  for (const id of next.keys()) {
    if (!prev.has(id) || next.get(id)!.retired) continue
    const from = [...(pb.get(id) ?? [])].sort()
    const to = [...(pa.get(id) ?? [])].sort()
    if (from.join() !== to.join()) reparented.push({ ingredient: nextSlug.get(id)!, from, to })
  }

  const measureRows = (a: Artifact) => [
    ...keyed(a.itemWeights, (r) => `w:${r.ingredient}:${r.name}`),
    ...keyed(a.densities, (r) => `d:${r.ingredient}`),
    ...keyed(a.packs, (r) => `p:${r.ingredient}:${r.noun}`),
    ...a.ingredients.map((i) => [`c:${i.id}`, JSON.stringify(i.canonical)] as [string, string]),
  ]
  return {
    added: added.sort(),
    retired: retired.sort(),
    renamed: renamed.sort((a, b) => (a.from < b.from ? -1 : 1)),
    reparented: reparented.sort((a, b) => (a.ingredient < b.ingredient ? -1 : 1)),
    propertyChanges: changed(
      keyed(before.properties, (r) => `${r.ingredient}:${r.property}`),
      keyed(after.properties, (r) => `${r.ingredient}:${r.property}`),
    ),
    measureChanges: changed(new Map(measureRows(before)), new Map(measureRows(after))),
  }
}

const sample = (items: string[], max = 20) =>
  items.slice(0, max).join(', ') + (items.length > max ? `, and ${items.length - max} more` : '')

export function formatDiff(diff: ArtifactDiff): string {
  const lines: string[] = []
  if (diff.added.length) lines.push(`added (${diff.added.length}): ${sample(diff.added)}`)
  if (diff.retired.length) lines.push(`retired (${diff.retired.length}): ${sample(diff.retired)}`)
  if (diff.renamed.length) {
    lines.push(
      `renamed (${diff.renamed.length}): ${sample(diff.renamed.map((r) => `${r.from} -> ${r.to}`))}`,
    )
  }
  if (diff.reparented.length) {
    lines.push(
      `reparented (${diff.reparented.length}): ${sample(
        diff.reparented.map(
          (r) => `${r.ingredient} (${r.from.join('+') || 'none'} -> ${r.to.join('+') || 'none'})`,
        ),
      )}`,
    )
  }
  if (diff.propertyChanges) lines.push(`property changes: ${diff.propertyChanges}`)
  if (diff.measureChanges) lines.push(`measure changes: ${diff.measureChanges}`)
  return lines.length ? lines.join('\n') : 'no changes'
}
