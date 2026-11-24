import { describe, expect, it } from 'vitest'
import { buildArtifact } from './build.ts'
import { diffArtifacts, formatDiff } from './diff.ts'
import { fixtureInputs, ownFiles } from './testing/fixtures.ts'

const build = (own: Record<string, string> = ownFiles) => buildArtifact(fixtureInputs(own))

describe('diffArtifacts', () => {
  it('is empty for equal artifacts', () => {
    expect(formatDiff(diffArtifacts(build(), build()))).toMatch(/no changes/i)
  })

  it('reports added, retired, renamed, reparented, and property and measure changes', () => {
    const before = build()
    const after = build({
      ...ownFiles,
      'ingredients.yaml': `
- key: plain-flour
  slug: flour-plain
  slug_aliases: [plain-flour]
  name: Plain flour
  parents: [wheat-flour]
- key: bicarbonate-of-soda
  slug: bicarbonate-of-soda
  name: Bicarbonate of soda
- key: saffron
  slug: saffron
  name: Saffron
`,
      'retired.yaml':
        '- slug: tomato-puree\n  off_id: en:tomato-puree\n  replaced_by: tomato-concentrate',
      'edges.yaml':
        ownFiles['edges.yaml'] +
        '- child: cheddar\n  parent: cheese\n  op: remove\n- child: cheddar\n  parent: dairy\n  op: add\n  kind: is_a\n',
      'dietary.yaml':
        "- ingredient: chicken\n  properties:\n    contains_meat_poultry: 'yes'\n    contains_egg: 'no'\n",
      'measures.yaml':
        '- ingredient: onion\n  canonical:\n    dimension: mass\n    set_by: agent\n',
    })
    const diff = diffArtifacts(before, after)
    expect(diff.added).toEqual(['saffron'])
    expect(diff.retired).toEqual(['tomato-puree'])
    expect(diff.renamed).toEqual([{ from: 'plain-flour', to: 'flour-plain' }])
    expect(diff.reparented).toEqual([{ ingredient: 'cheddar', from: ['cheese'], to: ['dairy'] }])
    expect(diff.propertyChanges).toBeGreaterThan(0)
    expect(diff.measureChanges).toBeGreaterThan(0)
    const text = formatDiff(diff)
    expect(text).toMatch(/added \(1\)/i)
    expect(text).toMatch(/plain-flour -> flour-plain/)
  })
})
