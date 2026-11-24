// The food knowledge base: the `kb` schema, written only by the KB load
// (docs/spec/food-knowledge-base.md sections 2 to 6, docs/spec/data-model.md
// section 8). Only `ingredient` is referenced by durable rows (recipe lines,
// always-haves, shopping list items), so the load upserts and retires
// ingredients and never deletes them; every other table here is a derived
// fact replaced by the load.
import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core'
import { instant } from './columns.ts'

export const kb = pgSchema('kb')

/** Where a fact came from. Precedence: own > intake24 > usda > off. */
export const factSourceEnum = kb.enum('fact_source', ['off', 'intake24', 'usda', 'own'])
/** `source`: stated by the source; `proxy`: borrowed from a similar food; `estimate`. */
export const factQualityEnum = kb.enum('fact_quality', ['source', 'proxy', 'estimate'])
export const edgeKindEnum = kb.enum('edge_kind', ['is_a', 'made_from'])
/** Tri-state dietary value. */
export const triStateEnum = kb.enum('tri_state', ['yes', 'no', 'unknown'])
export const dimensionEnum = kb.enum('dimension', ['count', 'volume', 'mass'])
export const packUnitEnum = kb.enum('pack_unit', ['g', 'ml', 'count'])
export const setByEnum = kb.enum('set_by', ['agent', 'owner'])

/**
 * An ingredient. The id is a stable surrogate (a UUIDv5 of the OFF id, or of
 * the own-layer key), so a rebuild from the same inputs mints the same ids.
 * Never deleted: a retired ingredient keeps its row and points `replaced_by`
 * at its successor.
 */
export const ingredient = kb.table(
  'ingredient',
  {
    id: uuid('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    /** The OFF taxonomy id (`en:onion`), used to match rows on re-import. */
    offId: text('off_id').unique(),
    wikidataId: text('wikidata_id'),
    ciqualId: text('ciqual_id'),
    displayName: text('display_name').notNull(),
    /** Who created the ingredient: an OFF entry or an own-layer one. */
    source: factSourceEnum('source').notNull(),
    retired: boolean('retired').notNull().default(false),
    replacedBy: uuid('replaced_by').references((): AnyPgColumn => ingredient.id),
    /** The canonical measure (own layer only). */
    canonicalDimension: dimensionEnum('canonical_dimension'),
    canonicalItemName: text('canonical_item_name'),
    canonicalDefaultSize: text('canonical_default_size'),
    canonicalSetBy: setByEnum('canonical_set_by'),
    loadedAt: instant('loaded_at').notNull().defaultNow(),
  },
  (t) => [index('ingredient_replaced_by_idx').on(t.replacedBy)],
)

/** Slugs an ingredient used to have, so saved queries (`ing:dairy`) keep working. */
export const ingredientSlugAlias = kb.table(
  'ingredient_slug_alias',
  {
    slug: text('slug').primaryKey(),
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredient.id),
  },
  (t) => [index('ingredient_slug_alias_ingredient_idx').on(t.ingredientId)],
)

/**
 * The name index input. `rank`: 0 own en-gb, 1 other own, 2 OFF
 * (food-knowledge-base.md section 7); `normalised` is lowercase, accent-free.
 */
export const ingredientName = kb.table(
  'ingredient_name',
  {
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredient.id),
    name: text('name').notNull(),
    normalised: text('normalised').notNull(),
    lang: text('lang').notNull(),
    source: factSourceEnum('source').notNull(),
    rank: integer('rank').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.ingredientId, t.name, t.lang] }),
    index('ingredient_name_normalised_idx').on(t.normalised),
  ],
)

/** A parent link: "is a" (the hierarchy) or "made from" (dietary derivation only). */
export const ingredientEdge = kb.table(
  'ingredient_edge',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => ingredient.id),
    parentId: uuid('parent_id')
      .notNull()
      .references(() => ingredient.id),
    kind: edgeKindEnum('kind').notNull(),
    source: factSourceEnum('source').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.childId, t.parentId] }),
    index('ingredient_edge_parent_idx').on(t.parentId),
  ],
)

/** The closure of "is a" edges, self included, rebuilt by every load. */
export const ancestor = kb.table(
  'ancestor',
  {
    nodeId: uuid('node_id')
      .notNull()
      .references(() => ingredient.id),
    ancestorId: uuid('ancestor_id')
      .notNull()
      .references(() => ingredient.id),
  },
  (t) => [
    primaryKey({ columns: [t.nodeId, t.ancestorId] }),
    index('ancestor_ancestor_idx').on(t.ancestorId),
  ],
)

/** A direct dietary value; inheritance down the edges is read-side. */
export const ingredientProperty = kb.table(
  'ingredient_property',
  {
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredient.id),
    property: text('property').notNull(),
    value: triStateEnum('value').notNull(),
    source: factSourceEnum('source').notNull(),
  },
  (t) => [primaryKey({ columns: [t.ingredientId, t.property] })],
)

/** A named size or unit to grams (medium onion 150 g). */
export const itemWeight = kb.table(
  'item_weight',
  {
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredient.id),
    name: text('name').notNull(),
    grams: doublePrecision('grams').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    source: factSourceEnum('source').notNull(),
    quality: factQualityEnum('quality').notNull(),
  },
  (t) => [primaryKey({ columns: [t.ingredientId, t.name] })],
)

export const density = kb.table('density', {
  ingredientId: uuid('ingredient_id')
    .primaryKey()
    .references(() => ingredient.id),
  gramsPerMl: doublePrecision('grams_per_ml').notNull(),
  source: factSourceEnum('source').notNull(),
  quality: factQualityEnum('quality').notNull(),
})

/** A typical pack (tin 400 g, bunch of coriander 30 g). Own layer only. */
export const pack = kb.table(
  'pack',
  {
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredient.id),
    noun: text('noun').notNull(),
    amount: doublePrecision('amount').notNull(),
    unit: packUnitEnum('unit').notNull(),
    source: factSourceEnum('source').notNull(),
    quality: factQualityEnum('quality').notNull(),
  },
  (t) => [primaryKey({ columns: [t.ingredientId, t.noun] })],
)

/** An aisle set directly on an ingredient; inheritance down "is a" is read-side. */
export const aisle = kb.table('aisle', {
  ingredientId: uuid('ingredient_id')
    .primaryKey()
    .references(() => ingredient.id),
  aisle: text('aisle').notNull(),
  source: factSourceEnum('source').notNull(),
})

/** The hierarchy nodes a `protein` tag value gates on. */
export const proteinBranch = kb.table(
  'protein_branch',
  {
    protein: text('protein').notNull(),
    ingredientId: uuid('ingredient_id')
      .notNull()
      .references(() => ingredient.id),
  },
  (t) => [primaryKey({ columns: [t.protein, t.ingredientId] })],
)
