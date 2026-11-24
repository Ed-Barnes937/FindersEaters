// Loads a KB artifact into the `kb` schema: upsert and retire ingredients,
// replace the derived fact tables, record the version in `ops.meta`, all in one
// transaction (docs/spec/operations.md section 3.1, data-model.md section 8).
// Never truncates `kb.ingredient`: durable rows reference it, so an ingredient
// that is no longer in the artifact is retired, not deleted.
import {
  aisle,
  ancestor,
  density,
  ingredient,
  ingredientEdge,
  ingredientName,
  ingredientProperty,
  ingredientSlugAlias,
  eq,
  inArray,
  itemWeight,
  KB_VERSION_KEY,
  meta,
  pack,
  proteinBranch,
  sql,
  type Db,
} from '@finders-eaters/db'
import type { Artifact } from './artifact.ts'

export interface LoadResult {
  /** False when the loaded version already equals the artifact's. */
  loaded: boolean
  version: string
  previousVersion: string | null
  ingredients: number
  /** Ingredients retired by this load because the artifact no longer has them. */
  vanished: number
}

export async function loadedKbVersion(db: Db): Promise<string | null> {
  const [row] = await db.select().from(meta).where(eq(meta.key, KB_VERSION_KEY))
  return row?.value ?? null
}

const CHUNK = 1000

/** Inserts rows in chunks, so no statement exceeds Postgres's bind-parameter limit. */
async function insertAll<T extends { $inferInsert: unknown }>(
  db: Db,
  table: T,
  rows: T['$inferInsert'][],
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(table as never).values(rows.slice(i, i + CHUNK) as never)
  }
}

export async function loadKnowledgeBase(db: Db, artifact: Artifact): Promise<LoadResult> {
  return db.transaction(async (tx) => {
    const previousVersion = await loadedKbVersion(tx)
    const base = {
      version: artifact.kbVersion,
      previousVersion,
      ingredients: artifact.ingredients.length,
    }
    if (previousVersion === artifact.kbVersion) return { ...base, loaded: false, vanished: 0 }

    const incoming = new Map(artifact.ingredients.map((i) => [i.id, i]))
    const incomingSlugs = new Set(artifact.ingredients.map((i) => i.slug))
    const existing = await tx.select({ id: ingredient.id, slug: ingredient.slug }).from(ingredient)

    // Free every slug that is about to change hands first, so a rename or a
    // swap never trips the unique index mid-load. A renamed ingredient keeps
    // its old slug as an alias; one that vanished just steps aside.
    const aliases: { slug: string; ingredientId: string }[] = []
    for (const row of existing) {
      const next = incoming.get(row.id)
      const renamed = next !== undefined && next.slug !== row.slug
      const taken = incomingSlugs.has(row.slug) && next?.slug !== row.slug
      if (renamed || taken) {
        await tx
          .update(ingredient)
          .set({ slug: `${row.slug}~${row.id.slice(0, 8)}` })
          .where(eq(ingredient.id, row.id))
        if (renamed) aliases.push({ slug: row.slug, ingredientId: row.id })
      }
    }

    for (let i = 0; i < artifact.ingredients.length; i += CHUNK) {
      await tx
        .insert(ingredient)
        .values(
          artifact.ingredients.slice(i, i + CHUNK).map((r) => ({
            id: r.id,
            slug: r.slug,
            offId: r.offId,
            wikidataId: r.wikidataId,
            ciqualId: r.ciqualId,
            displayName: r.displayName,
            source: r.source,
            retired: r.retired,
            replacedBy: null,
            canonicalDimension: r.canonical?.dimension ?? null,
            canonicalItemName: r.canonical?.itemName ?? null,
            canonicalDefaultSize: r.canonical?.defaultSize ?? null,
            canonicalSetBy: r.canonical?.setBy ?? null,
          })),
        )
        .onConflictDoUpdate({
          target: ingredient.id,
          set: {
            slug: sql`excluded.slug`,
            offId: sql`excluded.off_id`,
            wikidataId: sql`excluded.wikidata_id`,
            ciqualId: sql`excluded.ciqual_id`,
            displayName: sql`excluded.display_name`,
            source: sql`excluded.source`,
            retired: sql`excluded.retired`,
            replacedBy: sql`excluded.replaced_by`,
            canonicalDimension: sql`excluded.canonical_dimension`,
            canonicalItemName: sql`excluded.canonical_item_name`,
            canonicalDefaultSize: sql`excluded.canonical_default_size`,
            canonicalSetBy: sql`excluded.canonical_set_by`,
            loadedAt: sql`now()`,
          },
        })
    }
    // Replacement pointers go on once every row exists.
    for (const r of artifact.ingredients) {
      if (r.replacedBy)
        await tx.update(ingredient).set({ replacedBy: r.replacedBy }).where(eq(ingredient.id, r.id))
    }

    // Anything the artifact no longer has is retired, never deleted.
    const vanished = existing.filter((row) => !incoming.has(row.id)).map((row) => row.id)
    for (let i = 0; i < vanished.length; i += CHUNK) {
      await tx
        .update(ingredient)
        .set({ retired: true })
        .where(inArray(ingredient.id, vanished.slice(i, i + CHUNK)))
    }

    // Slug aliases: the artifact's own, plus old slugs of renamed rows. A slug
    // a live ingredient now uses is no alias of anything.
    for (const i of artifact.ingredients) {
      for (const alias of i.slugAliases) aliases.push({ slug: alias, ingredientId: i.id })
    }
    for (let i = 0; i < aliases.length; i += CHUNK) {
      await tx
        .insert(ingredientSlugAlias)
        .values(aliases.slice(i, i + CHUNK))
        .onConflictDoNothing()
    }
    await tx.execute(
      sql`delete from kb.ingredient_slug_alias where slug in (select slug from kb.ingredient)`,
    )

    // The derived fact tables are replaced whole; nothing durable references them.
    for (const table of [
      ancestor,
      ingredientEdge,
      ingredientName,
      ingredientProperty,
      itemWeight,
      density,
      pack,
      aisle,
      proteinBranch,
    ]) {
      await tx.delete(table)
    }
    await insertAll(
      tx,
      ingredientName,
      artifact.names.map((n) => ({
        ingredientId: n.ingredient,
        name: n.name,
        normalised: n.normalised,
        lang: n.lang,
        source: n.source,
        rank: n.rank,
      })),
    )
    await insertAll(
      tx,
      ingredientEdge,
      artifact.edges.map((e) => ({
        childId: e.child,
        parentId: e.parent,
        kind: e.kind,
        source: e.source,
      })),
    )
    await insertAll(
      tx,
      ancestor,
      artifact.ancestors.map((a) => ({ nodeId: a.node, ancestorId: a.ancestor })),
    )
    await insertAll(
      tx,
      ingredientProperty,
      artifact.properties.map((p) => ({
        ingredientId: p.ingredient,
        property: p.property,
        value: p.value,
        source: p.source,
      })),
    )
    await insertAll(
      tx,
      itemWeight,
      artifact.itemWeights.map((w) => ({
        ingredientId: w.ingredient,
        name: w.name,
        grams: w.grams,
        isDefault: w.isDefault,
        source: w.source,
        quality: w.quality,
      })),
    )
    await insertAll(
      tx,
      density,
      artifact.densities.map((d) => ({
        ingredientId: d.ingredient,
        gramsPerMl: d.gramsPerMl,
        source: d.source,
        quality: d.quality,
      })),
    )
    await insertAll(
      tx,
      pack,
      artifact.packs.map((p) => ({
        ingredientId: p.ingredient,
        noun: p.noun,
        amount: p.amount,
        unit: p.unit,
        source: p.source,
        quality: p.quality,
      })),
    )
    await insertAll(
      tx,
      aisle,
      artifact.aisles.map((a) => ({
        ingredientId: a.ingredient,
        aisle: a.aisle,
        source: a.source,
      })),
    )
    await insertAll(
      tx,
      proteinBranch,
      artifact.proteinBranches.map((b) => ({ protein: b.protein, ingredientId: b.ingredient })),
    )

    await tx
      .insert(meta)
      .values({ key: KB_VERSION_KEY, value: artifact.kbVersion })
      .onConflictDoUpdate({
        target: meta.key,
        set: { value: artifact.kbVersion, updatedAt: sql`now()` },
      })

    return { ...base, loaded: true, vanished: vanished.length }
  })
}
