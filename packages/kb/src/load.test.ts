// The KB load against a real Postgres: upsert and retire, never truncate, one
// transaction, idempotent on the KB version (docs/spec/operations.md 3.1).
import { eq, ingredient, ingredientName, meta, sql, KB_VERSION_KEY } from '@finders-eaters/db'
import { dbTest } from '@finders-eaters/db/testing'
import { describe, expect } from 'vitest'
import type { Artifact } from './artifact.ts'
import { buildArtifact } from './build.ts'
import { loadedKbVersion, loadKnowledgeBase } from './load.ts'
import { fixtureInputs, ownFiles } from './testing/fixtures.ts'

const build = (own: Record<string, string> = ownFiles): Artifact =>
  buildArtifact(fixtureInputs(own))
const idOf = (a: Artifact, slug: string) => a.ingredients.find((i) => i.slug === slug)!.id

const retireTomatoPuree = {
  ...ownFiles,
  'retired.yaml':
    '- slug: tomato-puree\n  off_id: en:tomato-puree\n  replaced_by: tomato-concentrate',
}

describe('loading the knowledge base', () => {
  dbTest('writes every table and records the version in ops.meta', async ({ db }) => {
    const artifact = build()
    expect(await loadedKbVersion(db)).toBeNull()

    const result = await loadKnowledgeBase(db, artifact)

    expect(result).toMatchObject({
      loaded: true,
      version: artifact.kbVersion,
      previousVersion: null,
    })
    expect(await loadedKbVersion(db)).toBe(artifact.kbVersion)
    const rows = await db.select().from(ingredient)
    expect(rows).toHaveLength(artifact.ingredients.length)
    const onion = rows.find((r) => r.slug === 'onion')!
    expect(onion).toMatchObject({
      id: idOf(artifact, 'onion'),
      offId: 'en:onion',
      wikidataId: 'Q23400',
      source: 'off',
      retired: false,
      canonicalDimension: 'count',
      canonicalDefaultSize: 'medium',
    })
    const counts = await db.execute<Record<string, number>>(sql`
      select (select count(*)::int from kb.ingredient_name) names,
             (select count(*)::int from kb.ingredient_edge) edges,
             (select count(*)::int from kb.ancestor) ancestors,
             (select count(*)::int from kb.item_weight) weights,
             (select count(*)::int from kb.density) densities,
             (select count(*)::int from kb.ingredient_property) properties,
             (select count(*)::int from kb.pack) packs,
             (select count(*)::int from kb.aisle) aisles,
             (select count(*)::int from kb.protein_branch) branches`)
    expect(counts.rows[0]).toEqual({
      names: artifact.names.length,
      edges: artifact.edges.length,
      ancestors: artifact.ancestors.length,
      weights: artifact.itemWeights.length,
      densities: artifact.densities.length,
      properties: artifact.properties.length,
      packs: artifact.packs.length,
      aisles: artifact.aisles.length,
      branches: artifact.proteinBranches.length,
    })
  })

  dbTest('does nothing when the loaded version is already the artifact version', async ({ db }) => {
    const artifact = build()
    await loadKnowledgeBase(db, artifact)
    await db.execute(sql`delete from kb.ingredient_name`)

    const again = await loadKnowledgeBase(db, artifact)

    expect(again).toMatchObject({ loaded: false, version: artifact.kbVersion })
    expect(await db.select().from(ingredientName)).toHaveLength(0)
  })

  dbTest('reloads when the version changes, and keeps ids stable', async ({ db }) => {
    const v1 = build()
    await loadKnowledgeBase(db, v1)
    const v2 = build({ ...ownFiles, 'aisles.yaml': '- ingredient: vegetable\n  aisle: produce' })

    const result = await loadKnowledgeBase(db, v2)

    expect(result).toMatchObject({ loaded: true, previousVersion: v1.kbVersion })
    const [aisle] = (await db.execute<{ aisle: string }>(sql`select aisle from kb.aisle`)).rows
    expect(aisle?.aisle).toBe('produce')
    const [onion] = await db.select().from(ingredient).where(eq(ingredient.slug, 'onion'))
    expect(onion?.id).toBe(idOf(v1, 'onion'))
    expect((await db.select().from(meta).where(eq(meta.key, KB_VERSION_KEY)))[0]?.value).toBe(
      v2.kbVersion,
    )
  })
})

describe('reload with a retired ingredient', () => {
  dbTest('keeps the row, marks it retired and points it at its replacement', async ({ db }) => {
    const v1 = build()
    await loadKnowledgeBase(db, v1)
    const v2 = build(retireTomatoPuree)

    await loadKnowledgeBase(db, v2)

    const [old] = await db
      .select()
      .from(ingredient)
      .where(eq(ingredient.id, idOf(v1, 'tomato-puree')))
    expect(old).toMatchObject({ retired: true, replacedBy: idOf(v1, 'tomato-concentrate') })
    const names = await db
      .select()
      .from(ingredientName)
      .where(eq(ingredientName.ingredientId, old!.id))
    expect(names).toHaveLength(0)
    const closure = await db.execute(sql`select 1 from kb.ancestor where node_id = ${old!.id}`)
    expect(closure.rows).toHaveLength(0)
  })

  dbTest(
    'never deletes an ingredient a durable row references, even one that vanished',
    async ({ db }) => {
      const v1 = build()
      await loadKnowledgeBase(db, v1)
      await db.execute(
        sql`create table public.recipe_line_stub (ingredient_id uuid references kb.ingredient(id))`,
      )
      const chickenBreast = idOf(v1, 'chicken-breast')
      await db.execute(sql`insert into public.recipe_line_stub values (${chickenBreast})`)

      // chicken-breast is simply absent from v2, with no replacement declared.
      const v2 = build()
      v2.kbVersion = 'next'
      v2.ingredients = v2.ingredients.filter((i) => i.id !== chickenBreast)
      v2.names = v2.names.filter((n) => n.ingredient !== chickenBreast)
      v2.edges = v2.edges.filter((e) => e.child !== chickenBreast && e.parent !== chickenBreast)
      v2.ancestors = v2.ancestors.filter(
        (a) => a.node !== chickenBreast && a.ancestor !== chickenBreast,
      )
      v2.itemWeights = v2.itemWeights.filter((w) => w.ingredient !== chickenBreast)
      v2.densities = v2.densities.filter((d) => d.ingredient !== chickenBreast)
      v2.properties = v2.properties.filter((p) => p.ingredient !== chickenBreast)

      await loadKnowledgeBase(db, v2)

      const [row] = await db.select().from(ingredient).where(eq(ingredient.id, chickenBreast))
      expect(row).toMatchObject({ retired: true, replacedBy: null })
      expect((await db.execute(sql`select * from public.recipe_line_stub`)).rows).toHaveLength(1)
    },
  )

  dbTest('keeps an old slug as an alias when the slug changes', async ({ db }) => {
    const v1 = build()
    await loadKnowledgeBase(db, v1)
    const renamed = build({
      ...ownFiles,
      'ingredients.yaml': ownFiles['ingredients.yaml']!.replace(
        'slug: plain-flour',
        'slug: flour-plain',
      ),
    })

    await loadKnowledgeBase(db, renamed)

    const aliases = await db.execute<{ slug: string; ingredient_id: string }>(
      sql`select slug, ingredient_id from kb.ingredient_slug_alias`,
    )
    expect(aliases.rows).toEqual([{ slug: 'plain-flour', ingredient_id: idOf(v1, 'plain-flour') }])
    const [row] = await db
      .select()
      .from(ingredient)
      .where(eq(ingredient.id, idOf(v1, 'plain-flour')))
    expect(row?.slug).toBe('flour-plain')
  })

  dbTest('lets two ingredients swap slugs in one load', async ({ db }) => {
    const v1 = build()
    await loadKnowledgeBase(db, v1)
    const v2 = structuredClone(v1)
    v2.kbVersion = 'swap'
    const a = v2.ingredients.find((i) => i.slug === 'onion')!
    const b = v2.ingredients.find((i) => i.slug === 'tomato')!
    ;[a.slug, b.slug] = [b.slug, a.slug]

    await loadKnowledgeBase(db, v2)

    const [row] = await db.select().from(ingredient).where(eq(ingredient.id, a.id))
    expect(row?.slug).toBe('tomato')
  })
})

describe('the ancestor closure', () => {
  const descendantsOf = async (db: Parameters<typeof loadedKbVersion>[0], slug: string) =>
    (
      await db.execute<{ slug: string }>(sql`
        select d.slug from kb.ancestor a
        join kb.ingredient anc on anc.id = a.ancestor_id and anc.slug = ${slug}
        join kb.ingredient d on d.id = a.node_id
        order by d.slug`)
    ).rows.map((r) => r.slug)
  const ancestorsOf = async (db: Parameters<typeof loadedKbVersion>[0], slug: string) =>
    (
      await db.execute<{ slug: string }>(sql`
        select anc.slug from kb.ancestor a
        join kb.ingredient n on n.id = a.node_id and n.slug = ${slug}
        join kb.ingredient anc on anc.id = a.ancestor_id
        order by anc.slug`)
    ).rows.map((r) => r.slug)

  dbTest(
    'answers "everything under dairy" and "everything above cheddar", self included',
    async ({ db }) => {
      await loadKnowledgeBase(db, build())

      expect(await descendantsOf(db, 'dairy')).toEqual(['cheddar', 'cheese', 'dairy'])
      expect(await ancestorsOf(db, 'cheddar')).toEqual([
        'animal-product',
        'cheddar',
        'cheese',
        'dairy',
      ])
    },
  )

  dbTest('follows "is a" only: chicken does not match chicken stock', async ({ db }) => {
    await loadKnowledgeBase(db, build())

    expect(await descendantsOf(db, 'chicken')).toEqual(['chicken', 'chicken-breast'])
  })

  dbTest('is rebuilt by each load, so a reparent leaves no stale rows', async ({ db }) => {
    await loadKnowledgeBase(db, build())
    await loadKnowledgeBase(
      db,
      build({
        ...ownFiles,
        'edges.yaml':
          ownFiles['edges.yaml'] +
          '- child: cheddar\n  parent: cheese\n  op: remove\n- child: cheddar\n  parent: vegetable\n  op: add\n  kind: is_a\n',
      }),
    )

    expect(await ancestorsOf(db, 'cheddar')).toEqual(['cheddar', 'vegetable'])
    expect(await descendantsOf(db, 'cheese')).toEqual(['cheese'])
  })
})
