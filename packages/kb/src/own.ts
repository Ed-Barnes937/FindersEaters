// The own layer: reviewed YAML files by concern, curated through pull requests
// (docs/spec/food-knowledge-base.md sections 3, 5, 6 and 9). Ingredients are
// referenced by slug (an OFF id without `en:`, or an own slug or old alias).
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from 'yaml'
import { z } from 'zod'

export const DIETARY_PROPERTIES = [
  'contains_meat_poultry',
  'contains_fish_shellfish',
  'contains_other_animal_product',
  'contains_gluten',
  'contains_milk',
  'contains_egg',
  'contains_tree_nuts_or_peanuts',
] as const

const slug = z.string().min(1)
const triState = z.enum(['yes', 'no', 'unknown'])
const quality = z.enum(['source', 'proxy', 'estimate'])
const setBy = z.enum(['agent', 'owner'])

const ingredients = z.array(
  z.strictObject({
    /** Immutable identity: the id derives from it, so the slug can change. */
    key: z.string().min(1),
    slug,
    name: z.string().min(1),
    slug_aliases: z.array(slug).default([]),
    /** "Is a" parents (OFF or own slugs). */
    parents: z.array(slug).default([]),
    wikidata: z.string().optional(),
  }),
)

const names = z.array(
  z.strictObject({
    ingredient: slug,
    lang: z.string().default('en-gb'),
    display_name: z.string().optional(),
    names: z.array(z.string().min(1)).default([]),
  }),
)

const edges = z.array(
  z
    .strictObject({
      child: slug,
      parent: slug,
      op: z.enum(['add', 'remove', 'reclassify']),
      kind: z.enum(['is_a', 'made_from']).optional(),
    })
    .refine((e) => e.op === 'remove' || e.kind !== undefined, 'add and reclassify need a kind'),
)

const dietary = z.array(
  z.strictObject({
    ingredient: slug,
    properties: z.partialRecord(z.enum(DIETARY_PROPERTIES), triState),
  }),
)

const itemWeight = z.strictObject({
  name: z.string().min(1),
  grams: z.number().positive(),
  default: z.boolean().default(false),
  quality: quality.default('source'),
})

const measures = z.array(
  z.strictObject({
    ingredient: slug,
    canonical: z
      .strictObject({
        dimension: z.enum(['count', 'volume', 'mass']),
        item_name: z.string().optional(),
        default_size: z.string().optional(),
        set_by: setBy,
      })
      .optional(),
    item_weights: z.array(itemWeight).optional(),
    density: z.strictObject({ g_per_ml: z.number().positive(), quality }).optional(),
  }),
)

const packs = z.array(
  z.strictObject({
    ingredient: slug,
    noun: z.string().min(1),
    amount: z.number().positive(),
    unit: z.enum(['g', 'ml', 'count']),
    quality: quality.default('source'),
  }),
)

const aisles = z.array(z.strictObject({ ingredient: slug, aisle: z.string().min(1) }))

const links = z.array(
  z.strictObject({
    ingredient: slug,
    /** An Intake24 food code. */
    intake24: z.string().optional(),
    /** A USDA FDC id, quoted in YAML so it stays a string. */
    usda: z.string().optional(),
  }),
)

const proteinBranches = z.array(
  z.strictObject({ protein: z.string().min(1), nodes: z.array(slug).min(1) }),
)

const retired = z.array(
  z
    .strictObject({
      slug,
      off_id: z.string().optional(),
      key: z.string().optional(),
      replaced_by: slug.nullable().default(null),
    })
    .refine(
      (r) => (r.off_id === undefined) !== (r.key === undefined),
      'give exactly one of off_id and key',
    ),
)

const expectations = z.array(z.strictObject({ name: z.string().min(1), slug }))

const files = {
  'ingredients.yaml': ingredients,
  'names.yaml': names,
  'edges.yaml': edges,
  'dietary.yaml': dietary,
  'measures.yaml': measures,
  'packs.yaml': packs,
  'aisles.yaml': aisles,
  'links.yaml': links,
  'protein-branches.yaml': proteinBranches,
  'retired.yaml': retired,
  'expectations.yaml': expectations,
} as const

export const OWN_FILE_NAMES = Object.keys(files)

export interface OwnLayer {
  ingredients: z.infer<typeof ingredients>
  names: z.infer<typeof names>
  edges: z.infer<typeof edges>
  dietary: z.infer<typeof dietary>
  measures: z.infer<typeof measures>
  packs: z.infer<typeof packs>
  aisles: z.infer<typeof aisles>
  links: z.infer<typeof links>
  proteinBranches: z.infer<typeof proteinBranches>
  retired: z.infer<typeof retired>
  /** Names that must resolve to a given ingredient (the known UK clashes). */
  expectations: z.infer<typeof expectations>
}

function read<K extends keyof typeof files>(
  contents: Record<string, string>,
  file: K,
): z.infer<(typeof files)[K]> {
  const text = contents[file]
  const raw: unknown = text === undefined ? [] : (parse(text) ?? [])
  const parsed = files[file].safeParse(raw)
  if (!parsed.success) throw new Error(`own/${file}: ${z.prettifyError(parsed.error)}`)
  return parsed.data as z.infer<(typeof files)[K]>
}

/** Parses the own layer from file contents keyed by file name; a missing file is empty. */
export function parseOwnLayer(contents: Record<string, string>): OwnLayer {
  for (const name of Object.keys(contents)) {
    if (!OWN_FILE_NAMES.includes(name)) {
      throw new Error(
        `own/${name} is not an own-layer file (expected one of ${OWN_FILE_NAMES.join(', ')})`,
      )
    }
  }
  return {
    ingredients: read(contents, 'ingredients.yaml'),
    names: read(contents, 'names.yaml'),
    edges: read(contents, 'edges.yaml'),
    dietary: read(contents, 'dietary.yaml'),
    measures: read(contents, 'measures.yaml'),
    packs: read(contents, 'packs.yaml'),
    aisles: read(contents, 'aisles.yaml'),
    links: read(contents, 'links.yaml'),
    proteinBranches: read(contents, 'protein-branches.yaml'),
    retired: read(contents, 'retired.yaml'),
    expectations: read(contents, 'expectations.yaml'),
  }
}

export async function readOwnLayer(dir: string): Promise<OwnLayer> {
  const contents: Record<string, string> = {}
  for (const name of (await readdir(dir)).sort()) {
    if (name.endsWith('.yaml')) contents[name] = await readFile(join(dir, name), 'utf8')
  }
  return parseOwnLayer(contents)
}
