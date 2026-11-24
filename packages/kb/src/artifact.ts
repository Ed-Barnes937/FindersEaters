// The KB artifact: one compressed JSON document carrying its KB version, built
// in CI and copied into the image, so a release never downloads a source
// (docs/spec/operations.md section 3).
import { createHash } from 'node:crypto'
import { gunzipSync, gzipSync } from 'node:zlib'
import { z } from 'zod'
import { sourcePinsSchema } from './sources/pins.ts'

export const ARTIFACT_FORMAT = 1

const id = z.uuid()
const source = z.enum(['off', 'intake24', 'usda', 'own'])
const quality = z.enum(['source', 'proxy', 'estimate'])

export const artifactSchema = z.strictObject({
  format: z.literal(ARTIFACT_FORMAT),
  kbVersion: z.string().min(1),
  sources: sourcePinsSchema,
  ingredients: z.array(
    z.strictObject({
      id,
      slug: z.string().min(1),
      slugAliases: z.array(z.string()),
      offId: z.string().nullable(),
      wikidataId: z.string().nullable(),
      ciqualId: z.string().nullable(),
      displayName: z.string().min(1),
      source: z.enum(['off', 'own']),
      retired: z.boolean(),
      replacedBy: id.nullable(),
      canonical: z
        .strictObject({
          dimension: z.enum(['count', 'volume', 'mass']),
          itemName: z.string().nullable(),
          defaultSize: z.string().nullable(),
          setBy: z.enum(['agent', 'owner']),
        })
        .nullable(),
    }),
  ),
  names: z.array(
    z.strictObject({
      ingredient: id,
      name: z.string().min(1),
      normalised: z.string().min(1),
      lang: z.string().min(1),
      source,
      rank: z.number().int(),
    }),
  ),
  edges: z.array(
    z.strictObject({ child: id, parent: id, kind: z.enum(['is_a', 'made_from']), source }),
  ),
  ancestors: z.array(z.strictObject({ node: id, ancestor: id })),
  properties: z.array(
    z.strictObject({
      ingredient: id,
      property: z.string().min(1),
      value: z.enum(['yes', 'no', 'unknown']),
      source,
    }),
  ),
  itemWeights: z.array(
    z.strictObject({
      ingredient: id,
      name: z.string().min(1),
      grams: z.number().positive(),
      isDefault: z.boolean(),
      source,
      quality,
    }),
  ),
  densities: z.array(
    z.strictObject({ ingredient: id, gramsPerMl: z.number().positive(), source, quality }),
  ),
  packs: z.array(
    z.strictObject({
      ingredient: id,
      noun: z.string().min(1),
      amount: z.number().positive(),
      unit: z.enum(['g', 'ml', 'count']),
      source,
      quality,
    }),
  ),
  aisles: z.array(z.strictObject({ ingredient: id, aisle: z.string().min(1), source })),
  proteinBranches: z.array(z.strictObject({ protein: z.string().min(1), ingredient: id })),
  expectations: z.array(z.strictObject({ name: z.string().min(1), slug: z.string().min(1) })),
  audit: z.strictObject({
    /** Facts that lost on precedence, kept so the build can show what was overridden. */
    candidates: z.array(
      z.strictObject({
        fact: z.enum(['itemWeight', 'density', 'property', 'edge']),
        ingredient: z.string(),
        source,
        value: z.string(),
      }),
    ),
    /** "Is a" edges the naming rule flags for review as "made from". */
    madeFromCandidates: z.array(
      z.strictObject({ child: z.string(), parent: z.string(), keyword: z.string() }),
    ),
  }),
})

export type Artifact = z.infer<typeof artifactSchema>
export type ArtifactIngredient = Artifact['ingredients'][number]

/** Deterministic JSON: object keys sorted at every level. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

/**
 * A hash of the artifact body without its version field. Whatever the build
 * emits changes the version, so a rule change cannot leave a stale KB loaded
 * (food-knowledge-base.md section 8).
 */
export function computeKbVersion(body: Omit<Artifact, 'kbVersion'>): string {
  return createHash('sha256').update(canonicalJson(body)).digest('hex').slice(0, 16)
}

/** Gzip carries no timestamp from Node, so equal artifacts are equal bytes. */
export function encodeArtifact(artifact: Artifact): Buffer {
  return gzipSync(JSON.stringify(artifact), { level: 9 })
}

export function decodeArtifact(bytes: Buffer): Artifact {
  let json: unknown
  try {
    json = JSON.parse(gunzipSync(bytes).toString('utf8'))
  } catch (cause) {
    throw new Error('not a KB artifact: the bytes are not gzipped JSON', { cause })
  }
  const parsed = artifactSchema.safeParse(json)
  if (!parsed.success) throw new Error(`invalid KB artifact: ${z.prettifyError(parsed.error)}`)
  return parsed.data
}
